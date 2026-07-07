import type { IFileSystem } from '@baishou/core-mobile'
import type {
  SyncManifest,
  S3SyncConfig,
  ManifestEntry,
  MergeDecision,
  IncrementalSyncRunOptions,
  IncrementalSyncStorageHistory
} from '@baishou/shared'
import {
  createEmptySyncManifest,
  getIncrementalSyncStorageId,
  isIncrementalSyncRemoteFileNotFoundError,
  normalizeSyncManifest,
  reconcileSyncManifestRemovedWithRemoteFiles,
  resolveIncrementalSyncStorageHistory,
  SYNC_MANIFEST_FILENAME,
  SYNC_REMOTE_SNAPSHOT_FILENAME,
  SYNC_STORAGE_ID_FILENAME
} from '@baishou/shared'
import type { IStoragePathService } from '@baishou/core-mobile'
import { getAppCacheDirectory } from './mobile-app-paths'
import { MobileIncrementalCloudClient } from './mobile-incremental-cloud.client'
import {
  writeIncrementalSyncSession,
  type IncrementalSyncSessionMode
} from './mobile-incremental-sync-session.util'
import { IncrementalManifestCommitQueue } from './mobile-incremental-manifest-commit.util'
import { resolveMobileIncrementalSyncFullPath } from './mobile-incremental-sync-path.util'
import { loadVaultExternalSyncMounts } from '@baishou/core-mobile'
import type { VaultExternalSyncMount } from '@baishou/shared'
import type {
  MobileIncrementalExecutionContext,
  MobileIncrementalProgress,
  MobileIncrementalSyncOutcome
} from './mobile-incremental-engine.types'
import { runSyncThreeWay } from './mobile-incremental-engine-sync.ops'
import {
  applyDecisionToManifest as applyDecisionToManifestOp,
  buildLocalManifest as buildLocalManifestOp,
  finalizeManifestAfterSync as finalizeManifestAfterSyncOp
} from './mobile-incremental-engine-manifest.ops'
import {
  bindTransferProgress as bindTransferProgressHelper,
  emitFileTransferStart as emitFileTransferStartHelper,
  resolveInFlightTransfer as resolveInFlightTransferHelper,
  trackInFlightTransfer as trackInFlightTransferHelper
} from './mobile-incremental-engine-transfer.helpers'
import { createCheckpointRuntime as createCheckpointRuntimeHelper } from './mobile-incremental-engine-checkpoint.helpers'

function joinPath(...parts: string[]): string {
  return parts
    .map((p, i) => {
      if (i === 0) return p.replace(/\/$/, '')
      return p.replace(/^\//, '').replace(/\/$/, '')
    })
    .filter(Boolean)
    .join('/')
}

export type IncrementalEngineHost = {
  pathService: IStoragePathService
  fileSystem: IFileSystem
  deviceId: string
  manifestUploadQueue: Promise<void>
  setManifestUploadQueue(task: Promise<void>): void
  planManifestCache: { local: SyncManifest; remote: SyncManifest } | null
  setPlanManifestCache(v: { local: SyncManifest; remote: SyncManifest } | null): void
  pendingSyncLocalManifest: SyncManifest | null
  pendingSyncRemoteManifest: SyncManifest | null
  takePendingSyncLocalManifest(): SyncManifest | null
  takePendingSyncRemoteManifest(): SyncManifest | null
  manifestCommitQueue: IncrementalManifestCommitQueue
  externalSyncMounts: VaultExternalSyncMount[] | null
  setExternalSyncMounts(v: VaultExternalSyncMount[] | null): void
  lastConflicts: string[]
  setLastConflicts(v: string[]): void
  invalidateExternalSyncMounts(): void
}

type IncrementalProgressCallback = (progress: MobileIncrementalProgress) => void

export class MobileIncrementalEngineWorker {
  constructor(readonly host: IncrementalEngineHost) {}

  async loadPlanManifests(
    config: S3SyncConfig,
    onProgress?: IncrementalProgressCallback
  ): Promise<{ local: SyncManifest; remote: SyncManifest }> {
    if (this.host.planManifestCache) {
      return this.host.planManifestCache!
    }

    const syncRoot = await this.syncRoot()
    const client = new MobileIncrementalCloudClient(config, this.host.fileSystem)
    client.setVaultPath(syncRoot)

    onProgress?.({ phase: 'scanning', current: 0, total: 0 })
    const localPromise = this.buildLocalManifest((current, total, fileName) => {
      onProgress?.({ phase: 'scanning', current, total, fileName })
    })
    onProgress?.({ phase: 'comparing', current: 0, total: 1 })
    const remotePromise = this.getRemoteManifest(client, (current, total, fileName) => {
      onProgress?.({ phase: 'comparing', current, total, fileName })
    })
    const [local, remote] = await Promise.all([localPromise, remotePromise])
    onProgress?.({ phase: 'comparing', current: 1, total: 1 })

    this.host.setPlanManifestCache({ local, remote })
    return this.host.planManifestCache!
  }

  async syncRoot(): Promise<string> {
    return this.host.pathService.getRootDirectory()
  }

  async syncMetaDir(): Promise<string> {
    return `${await this.syncRoot()}/.baishou`
  }

  manifestPath(metaDir: string): string {
    return joinPath(metaDir, SYNC_MANIFEST_FILENAME)
  }

  enqueueRemoteManifestUpload(
    metaDir: string,
    client: MobileIncrementalCloudClient
  ): Promise<void> {
    const task = this.host.manifestUploadQueue
      .catch(() => {})
      .then(() =>
        client.uploadFile(this.manifestPath(metaDir), `.baishou/${SYNC_MANIFEST_FILENAME}`)
      )
    this.host.setManifestUploadQueue(task)
    return task
  }

  snapshotPath(metaDir: string): string {
    return joinPath(metaDir, SYNC_REMOTE_SNAPSHOT_FILENAME)
  }

  async buildLocalManifest(
    onProgress?: (current: number, total: number, fileName: string) => void
  ): Promise<SyncManifest> {
    return buildLocalManifestOp(this, onProgress)
  }

  async finalizeManifestAfterSync(
    baseManifest: SyncManifest,
    decisions: MergeDecision[],
    syncRoot: string,
    onProgress?: IncrementalProgressCallback
  ): Promise<SyncManifest> {
    return finalizeManifestAfterSyncOp(this, baseManifest, decisions, syncRoot, onProgress)
  }

  async applyDecisionToManifest(
    manifest: SyncManifest,
    decision: MergeDecision,
    syncRoot: string
  ): Promise<SyncManifest> {
    return applyDecisionToManifestOp(this, manifest, decision, syncRoot)
  }

  async flushRemoteManifestCheckpoint(
    metaDir: string,
    client: MobileIncrementalCloudClient
  ): Promise<void> {
    await this.enqueueRemoteManifestUpload(metaDir, client)
  }

  async touchSyncSession(
    metaDir: string,
    mode: IncrementalSyncSessionMode,
    total: number,
    completed: number,
    lastFile?: string,
    startedAt?: number
  ): Promise<void> {
    const now = Date.now()
    await writeIncrementalSyncSession(this.host.fileSystem, metaDir, {
      startedAt: startedAt ?? now,
      updatedAt: now,
      total,
      completed,
      lastFile,
      mode
    })
  }

  createCheckpointRuntime(
    metaDir: string,
    client: MobileIncrementalCloudClient,
    config: S3SyncConfig
  ) {
    return createCheckpointRuntimeHelper({
      saveLocalManifest: (manifest) => this.saveLocalManifest(manifest),
      saveRemoteSnapshot: (manifest) => this.saveRemoteSnapshot(manifest, config),
      flushRemoteManifestCheckpoint: () => this.flushRemoteManifestCheckpoint(metaDir, client),
      touchSyncSession: (state) =>
        this.touchSyncSession(
          state.metaDir,
          state.mode,
          state.total,
          state.completed,
          state.lastFile,
          state.startedAt
        )
    })
  }

  resolveInFlightTransfer(
    inFlight: Map<string, { relPath: string; action: MobileIncrementalProgress['action'] }>,
    filePath: string
  ) {
    return resolveInFlightTransferHelper(inFlight, filePath)
  }

  emitFileTransferStart(
    onProgress: IncrementalProgressCallback | undefined,
    completed: number,
    total: number,
    filePath: string,
    action: MobileIncrementalProgress['action'],
    fileBytesTotal?: number
  ) {
    emitFileTransferStartHelper(onProgress, completed, total, filePath, action, fileBytesTotal)
  }

  bindTransferProgress(
    client: MobileIncrementalCloudClient,
    onProgress: IncrementalProgressCallback | undefined,
    getCompleted: () => number,
    total: number,
    inFlight: Map<string, { relPath: string; action: MobileIncrementalProgress['action'] }>
  ): (relPath: string) => { done: number; total: number } | undefined {
    return bindTransferProgressHelper(client, onProgress, getCompleted, total, inFlight)
  }

  trackInFlightTransfer(
    inFlight: Map<string, { relPath: string; action: MobileIncrementalProgress['action'] }>,
    fullPath: string,
    relPath: string,
    action: MobileIncrementalProgress['action']
  ) {
    trackInFlightTransferHelper(inFlight, fullPath, relPath, action)
  }

  async saveLocalManifest(manifest: SyncManifest): Promise<void> {
    const metaDir = await this.syncMetaDir()
    const mp = this.manifestPath(metaDir)
    if (!(await this.host.fileSystem.exists(metaDir))) {
      await this.host.fileSystem.mkdir(metaDir, { recursive: true })
    }
    await this.host.fileSystem.writeFile(mp, JSON.stringify(manifest, null, 2))
  }

  storageIdPath(metaDir: string): string {
    return joinPath(metaDir, SYNC_STORAGE_ID_FILENAME)
  }

  emptyManifest(): SyncManifest {
    return createEmptySyncManifest(this.host.deviceId)
  }

  /** 合并磁盘与内存中的 manifest 条目，较新的来源覆盖较旧（用于跳过未变更文件的 MD5） */
  mergeManifestFileCaches(...sources: Array<SyncManifest | null | undefined>): SyncManifest {
    const merged = this.emptyManifest()
    for (const source of sources) {
      if (!source?.files) continue
      Object.assign(merged.files, source.files)
    }
    return merged
  }

  async fetchRemoteManifestLight(config: S3SyncConfig, syncRoot: string): Promise<SyncManifest> {
    const client = new MobileIncrementalCloudClient(config, this.host.fileSystem)
    client.setVaultPath(syncRoot)
    const rel = `.baishou/${SYNC_MANIFEST_FILENAME}`
    const temp = `${getAppCacheDirectory()}temp-remote-scopes-${Date.now()}.json`
    try {
      await client.downloadFile(rel, temp)
      const raw = await this.host.fileSystem.readFile(temp)
      return normalizeSyncManifest(JSON.parse(raw) as SyncManifest)
    } catch {
      return this.emptyManifest()
    } finally {
      await this.host.fileSystem.unlink(temp).catch(() => {})
    }
  }

  async readLocalManifestFile(): Promise<SyncManifest> {
    const metaDir = await this.syncMetaDir()
    const mp = this.manifestPath(metaDir)
    if (!(await this.host.fileSystem.exists(mp))) {
      return this.emptyManifest()
    }
    const raw = await this.host.fileSystem.readFile(mp)
    return JSON.parse(raw) as SyncManifest
  }

  async getSyncStorageHistoryState(config: S3SyncConfig): Promise<IncrementalSyncStorageHistory> {
    const metaDir = await this.syncMetaDir()
    const storageIdPath = this.storageIdPath(metaDir)
    if (!(await this.host.fileSystem.exists(storageIdPath))) {
      return 'none'
    }
    try {
      const savedId = (await this.host.fileSystem.readFile(storageIdPath)).trim()
      return resolveIncrementalSyncStorageHistory(savedId, config)
    } catch {
      return 'mismatch'
    }
  }

  async loadRemoteSnapshot(config: S3SyncConfig): Promise<SyncManifest> {
    const metaDir = await this.syncMetaDir()
    const sp = this.snapshotPath(metaDir)
    if (!(await this.host.fileSystem.exists(sp))) {
      return this.emptyManifest()
    }

    const storageIdPath = this.storageIdPath(metaDir)
    const currentStorageId = getIncrementalSyncStorageId(config)
    if (await this.host.fileSystem.exists(storageIdPath)) {
      try {
        const savedId = (await this.host.fileSystem.readFile(storageIdPath)).trim()
        if (savedId !== currentStorageId) {
          return this.emptyManifest()
        }
      } catch {
        return this.emptyManifest()
      }
    } else {
      return this.emptyManifest()
    }

    try {
      return JSON.parse(await this.host.fileSystem.readFile(sp)) as SyncManifest
    } catch {
      return this.emptyManifest()
    }
  }

  async saveRemoteSnapshot(manifest: SyncManifest, config: S3SyncConfig): Promise<void> {
    const metaDir = await this.syncMetaDir()
    const sp = this.snapshotPath(metaDir)
    if (!(await this.host.fileSystem.exists(metaDir))) {
      await this.host.fileSystem.mkdir(metaDir, { recursive: true })
    }
    await this.host.fileSystem.writeFile(sp, JSON.stringify(manifest, null, 2))
    await this.host.fileSystem.writeFile(
      this.storageIdPath(metaDir),
      getIncrementalSyncStorageId(config)
    )
  }

  async getRemoteManifest(
    client: MobileIncrementalCloudClient,
    onProgress?: (current: number, total: number, fileName: string) => void
  ): Promise<SyncManifest> {
    onProgress?.(0, 0, '')
    const files = await client.listFiles()
    const actualFilesSet = new Set(files.map((f) => f.filename.replace(/\\/g, '/')))
    const hit = files.find(
      (f) =>
        f.filename === SYNC_MANIFEST_FILENAME ||
        f.filename.endsWith(`/${SYNC_MANIFEST_FILENAME}`) ||
        f.filename.endsWith(`.baishou/${SYNC_MANIFEST_FILENAME}`)
    )
    if (!hit) {
      return this.emptyManifest()
    }
    const temp = `${getAppCacheDirectory()}temp-remote-${Date.now()}.json`
    await client.downloadFile(hit.filename, temp)
    const raw = await this.host.fileSystem.readFile(temp)
    await this.host.fileSystem.unlink(temp)
    const manifest = normalizeSyncManifest(JSON.parse(raw) as SyncManifest)

    if (manifest.files) {
      const cleanFiles: Record<string, ManifestEntry> = {}
      for (const [relPath, entry] of Object.entries(manifest.files)) {
        const normalizedPath = relPath.replace(/\\/g, '/')
        if (actualFilesSet.has(normalizedPath)) {
          cleanFiles[normalizedPath] = entry
        }
      }
      manifest.files = cleanFiles
      return reconcileSyncManifestRemovedWithRemoteFiles(manifest, actualFilesSet)
    }

    return manifest
  }

  async downloadSyncFile(
    client: MobileIncrementalCloudClient,
    relPath: string,
    fullPath: string,
    size: number
  ): Promise<boolean> {
    try {
      await client.downloadFile(relPath, fullPath, size > 0 ? size : undefined)
      return await this.host.fileSystem.exists(fullPath)
    } catch (error) {
      if (isIncrementalSyncRemoteFileNotFoundError(error)) {
        console.warn(`[MobileIncremental] Remote file missing, skip download: ${relPath}`)
        return false
      }
      throw error
    }
  }

  async backupLocalFile(syncRoot: string, relPath: string): Promise<void> {
    const src = await this.resolveSyncFullPath(syncRoot, relPath)
    if (!(await this.host.fileSystem.exists(src))) return
    const backupFile = joinPath(syncRoot, '.versions', relPath, `${Date.now()}.bak`)
    const bdir = backupFile.replace(/\/[^/]+$/, '')
    if (!(await this.host.fileSystem.exists(bdir))) {
      await this.host.fileSystem.mkdir(bdir, { recursive: true })
    }
    await this.host.fileSystem.copyFile(src, backupFile)
  }

  async resolveSyncFullPath(syncRoot: string, relPath: string): Promise<string> {
    const mounts = await this.getExternalSyncMounts(syncRoot)
    return resolveMobileIncrementalSyncFullPath(this.host.fileSystem, syncRoot, relPath, mounts)
  }

  private async getExternalSyncMounts(syncRoot: string): Promise<VaultExternalSyncMount[]> {
    if (!this.host.externalSyncMounts) {
      this.host.setExternalSyncMounts(
        await loadVaultExternalSyncMounts(this.host.fileSystem, syncRoot)
      )
    }
    return this.host.externalSyncMounts!
  }

  async syncThreeWay(
    config: S3SyncConfig,
    onProgress?: IncrementalProgressCallback,
    runOptions?: IncrementalSyncRunOptions,
    execution?: MobileIncrementalExecutionContext
  ): Promise<MobileIncrementalSyncOutcome> {
    return runSyncThreeWay(this, config, onProgress, runOptions, execution)
  }
}
