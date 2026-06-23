import * as fs from 'fs'
import * as path from 'path'
import type { SyncManifest, ManifestEntry, S3SyncConfig, SyncProgressCallback } from '@baishou/shared'
import {
  SYNC_MANIFEST_FILENAME,
  SYNC_MANIFEST_VERSION,
  SYNC_REMOTE_SNAPSHOT_FILENAME,
  SYNC_STORAGE_ID_FILENAME,
  getIncrementalSyncStorageId,
  resolveIncrementalSyncStorageHistory,
  type IncrementalSyncStorageHistory,
  createEmptySyncManifest,
  normalizeSyncManifest,
  reconcileSyncManifestRemovedWithRemoteFiles,
  isIncrementalSyncRemoteFileNotFoundError
} from '@baishou/shared'
import { isSqliteRuntimeSyncPath } from '@baishou/shared'
import { ThreeWaySyncCore } from './three-way-sync.core'

export type ManifestFileProgressCallback = (
  current: number,
  total: number,
  fileName: string
) => void

export interface PreparedSyncManifests {
  localManifest: SyncManifest
  remoteManifest: SyncManifest
  ancestorSnapshot: SyncManifest
  previousLocalManifest: SyncManifest
  storageHistory: IncrementalSyncStorageHistory
  preparedAt: number
}

export abstract class ThreeWaySyncManifestMixin extends ThreeWaySyncCore {
  private static readonly MANIFEST_CACHE_TTL_MS = 120_000

  private preparedManifests: PreparedSyncManifests | null = null

  private planManifestCache: {
    local: SyncManifest
    remote: SyncManifest
  } | null = null

  protected invalidatePreparedManifests(): void {
    this.preparedManifests = null
    this.planManifestCache = null
  }

  clearPreparedManifestCache(): void {
    this.invalidatePreparedManifests()
    this.clearPlanManifestCache()
    this.invalidateExternalSyncMounts()
  }

  setPlanManifestCache(local: SyncManifest, remote: SyncManifest): void {
    this.planManifestCache = { local, remote }
  }

  clearPlanManifestCache(): void {
    this.planManifestCache = null
  }

  protected async loadPlanManifestsForPreview(): Promise<{
    local: SyncManifest
    remote: SyncManifest
  }> {
    if (this.planManifestCache) {
      return this.planManifestCache
    }
    const local = await this.buildLocalManifest()
    const remote = await this.getRemoteManifest()
    this.planManifestCache = { local, remote }
    return this.planManifestCache
  }

  protected async prepareSyncManifests(options?: {
    onProgress?: SyncProgressCallback
    forceRefresh?: boolean
  }): Promise<PreparedSyncManifests> {
    const onProgress = options?.onProgress
    if (
      !options?.forceRefresh &&
      this.preparedManifests &&
      Date.now() - this.preparedManifests.preparedAt < ThreeWaySyncManifestMixin.MANIFEST_CACHE_TTL_MS
    ) {
      onProgress?.({ phase: 'comparing', current: 1, total: 1 })
      return this.preparedManifests
    }

    await this.loadConfig()

    let localManifest: SyncManifest
    let remoteManifest: SyncManifest

    if (!options?.forceRefresh && this.planManifestCache) {
      localManifest = this.planManifestCache.local
      remoteManifest = this.planManifestCache.remote
      onProgress?.({ phase: 'comparing', current: 1, total: 1 })
    } else {
      onProgress?.({ phase: 'scanning', current: 0, total: 0 })
      localManifest = await this.buildLocalManifest((current, total, fileName) => {
        onProgress?.({ phase: 'scanning', current, total, fileName })
      })
      onProgress?.({ phase: 'comparing', current: 0, total: 1 })
      remoteManifest = await this.getRemoteManifest()
      onProgress?.({ phase: 'comparing', current: 1, total: 1 })
      this.planManifestCache = { local: localManifest, remote: remoteManifest }
    }

    const storageHistory = await this.getSyncStorageHistoryState()
    const ancestorSnapshot = await this.getRemoteSnapshot()
    const previousLocalManifest = await this.getLocalManifest()

    this.preparedManifests = {
      localManifest,
      remoteManifest,
      ancestorSnapshot,
      previousLocalManifest,
      storageHistory,
      preparedAt: Date.now()
    }
    return this.preparedManifests
  }

  async getConfig(): Promise<S3SyncConfig> {
    await this.loadConfig()
    return this.config
  }

  async updateConfig(config: Partial<S3SyncConfig>): Promise<void> {
    this.config = { ...this.config, ...config }
    this.invalidatePreparedManifests()
    this.clearPlanManifestCache()
    await this.saveConfig()
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.cloudClient.listFiles()
      return true
    } catch {
      return false
    }
  }

  async buildLocalManifest(
    onFileProgress?: ManifestFileProgressCallback
  ): Promise<SyncManifest> {
    const files = await this.scanLocalFiles()
    const manifest: SyncManifest = {
      version: SYNC_MANIFEST_VERSION,
      updatedAt: Date.now(),
      deviceId: this.deviceId,
      files: {}
    }

    const total = files.length
    onFileProgress?.(0, total, '')

    for (let index = 0; index < files.length; index++) {
      const relPath = files[index]!
      const fullPath = await this.resolveSyncFullPath(relPath)
      try {
        const hash = await this.computeFileHash(fullPath)
        const stat = await fs.promises.stat(fullPath)
        manifest.files[relPath] = {
          hash,
          size: stat.size,
          lastModified: stat.mtimeMs
        }
      } catch {}
      onFileProgress?.(index + 1, total, relPath)
    }

    return manifest
  }

  async getLocalManifest(): Promise<SyncManifest> {
    const metaDir = await this.getSyncMetaDirectory()
    const manifestPath = path.join(metaDir, SYNC_MANIFEST_FILENAME)

    if (fs.existsSync(manifestPath)) {
      const raw = await fs.promises.readFile(manifestPath, 'utf8')
      return JSON.parse(raw) as SyncManifest
    }

    return createEmptySyncManifest()
  }

  async refreshLocalManifest(): Promise<SyncManifest> {
    const manifest = await this.buildLocalManifest()
    await this.saveLocalManifest(manifest)
    return manifest
  }

  async getRemoteManifest(): Promise<SyncManifest> {
    const remoteFiles = await this.cloudClient.listFiles()
    const manifestFile = remoteFiles.find(
      (f) =>
        f.filename === SYNC_MANIFEST_FILENAME || f.filename.endsWith('/' + SYNC_MANIFEST_FILENAME)
    )

    if (!manifestFile) {
      return createEmptySyncManifest()
    }

    const metaDir = await this.getSyncMetaDirectory()
    const tempPath = path.join(
      metaDir,
      `temp-remote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
    )
    await fs.promises.mkdir(metaDir, { recursive: true })
    await this.cloudClient.downloadFile(manifestFile.filename, tempPath)

    try {
      const raw = await fs.promises.readFile(tempPath, 'utf8')
      const manifest = normalizeSyncManifest(JSON.parse(raw) as SyncManifest)

      if (manifest.files) {
        const actualFilesSet = new Set<string>()
        for (const f of remoteFiles) {
          actualFilesSet.add(f.filename.replace(/\\/g, '/'))
        }

        const cleanFiles: Record<string, ManifestEntry> = {}
        for (const [relPath, entry] of Object.entries(manifest.files)) {
          const normalizedPath = relPath.replace(/\\/g, '/')
          if (actualFilesSet.has(normalizedPath)) {
            cleanFiles[normalizedPath] = entry
          } else {
            console.warn(
              `[ThreeWaySync] Remote manifest contains phantom file: ${relPath}, but it is missing on remote storage. Treating as deleted.`
            )
          }
        }
        manifest.files = cleanFiles
        return reconcileSyncManifestRemovedWithRemoteFiles(manifest, actualFilesSet)
      }

      return manifest
    } finally {
      try {
        fs.unlinkSync(tempPath)
      } catch {}
    }
  }

  async getSyncStorageHistoryState(): Promise<IncrementalSyncStorageHistory> {
    await this.loadConfig()
    const metaDir = await this.getSyncMetaDirectory()
    const storageIdPath = path.join(metaDir, SYNC_STORAGE_ID_FILENAME)
    if (!fs.existsSync(storageIdPath)) {
      return 'none'
    }
    try {
      const savedId = (await fs.promises.readFile(storageIdPath, 'utf8')).trim()
      return resolveIncrementalSyncStorageHistory(savedId, this.config)
    } catch {
      return 'mismatch'
    }
  }

  async getRemoteSnapshot(): Promise<SyncManifest> {
    await this.loadConfig()
    const metaDir = await this.getSyncMetaDirectory()
    const snapshotPath = path.join(metaDir, SYNC_REMOTE_SNAPSHOT_FILENAME)
    const storageIdPath = path.join(metaDir, SYNC_STORAGE_ID_FILENAME)
    const currentStorageId = getIncrementalSyncStorageId(this.config)

    const empty = createEmptySyncManifest()

    if (!fs.existsSync(snapshotPath)) {
      return empty
    }

    if (fs.existsSync(storageIdPath)) {
      try {
        const savedId = (await fs.promises.readFile(storageIdPath, 'utf8')).trim()
        if (savedId !== currentStorageId) {
          return empty
        }
      } catch {
        return empty
      }
    } else {
      // 无存储标识的旧快照：不与当前目标混用
      return empty
    }

    try {
      const raw = await fs.promises.readFile(snapshotPath, 'utf8')
      return JSON.parse(raw) as SyncManifest
    } catch {
      return empty
    }
  }

  getLastSyncConflicts(): Promise<string[]> {
    return Promise.resolve(this.lastConflicts)
  }

  protected async saveLocalManifest(manifest: SyncManifest): Promise<void> {
    const metaDir = await this.getSyncMetaDirectory()
    const manifestPath = path.join(metaDir, SYNC_MANIFEST_FILENAME)
    await fs.promises.mkdir(metaDir, { recursive: true })
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  }

  protected async uploadManifest(): Promise<void> {
    const metaDir = await this.getSyncMetaDirectory()
    const manifestPath = path.join(metaDir, SYNC_MANIFEST_FILENAME)
    if (fs.existsSync(manifestPath)) {
      await this.cloudClient.uploadFile(manifestPath)
    }
  }

  protected async saveRemoteSnapshot(manifest: SyncManifest): Promise<void> {
    await this.loadConfig()
    const metaDir = await this.getSyncMetaDirectory()
    const snapshotPath = path.join(metaDir, SYNC_REMOTE_SNAPSHOT_FILENAME)
    const storageIdPath = path.join(metaDir, SYNC_STORAGE_ID_FILENAME)
    await fs.promises.mkdir(metaDir, { recursive: true })
    await fs.promises.writeFile(snapshotPath, JSON.stringify(manifest, null, 2), 'utf8')
    await fs.promises.writeFile(storageIdPath, getIncrementalSyncStorageId(this.config), 'utf8')
  }

  protected async uploadFile(relPath: string): Promise<void> {
    if (isSqliteRuntimeSyncPath(relPath)) {
      console.warn(`[ThreeWaySync] Skipping SQLite runtime file upload: ${relPath}`)
      return
    }
    const fullPath = await this.resolveSyncFullPath(relPath)
    if (fs.existsSync(fullPath)) {
      await this.cloudClient.uploadFile(fullPath)
    }
  }

  protected async downloadFile(relPath: string): Promise<boolean> {
    if (isSqliteRuntimeSyncPath(relPath)) {
      console.warn(`[ThreeWaySync] Skipping SQLite runtime file download: ${relPath}`)
      return false
    }
    const fullPath = await this.resolveSyncFullPath(relPath)
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true })
    try {
      await this.cloudClient.downloadFile(relPath, fullPath)
      return true
    } catch (err: unknown) {
      if (isIncrementalSyncRemoteFileNotFoundError(err)) {
        console.warn(
          `[ThreeWaySync] Remote file is missing (NotFound): ${relPath}. Skipping download.`
        )
        return false
      }
      throw err
    }
  }

  protected async deleteRemoteFile(relPath: string): Promise<void> {
    await this.cloudClient.deleteFile(relPath)
  }

  protected async deleteLocalFile(relPath: string): Promise<void> {
    const fullPath = await this.resolveSyncFullPath(relPath)
    if (fs.existsSync(fullPath)) {
      if (this.versionManager) {
        try {
          await this.versionManager.backup(fullPath)
        } catch {}
      } else {
        try {
          const ext = path.extname(fullPath)
          const base = fullPath.slice(0, -ext.length || undefined)
          const ts = Date.now()
          const backupPath = `${base}.conflict-${ts}${ext}`
          await fs.promises.copyFile(fullPath, backupPath)
        } catch {}
      }
      fs.unlinkSync(fullPath)
    }
  }

  protected async backupFile(relPath: string, _hash: string): Promise<void> {
    if (!this.versionManager) return
    const fullPath = await this.resolveSyncFullPath(relPath)
    if (fs.existsSync(fullPath)) {
      try {
        await this.versionManager.backup(fullPath)
      } catch {}
    }
  }
}
