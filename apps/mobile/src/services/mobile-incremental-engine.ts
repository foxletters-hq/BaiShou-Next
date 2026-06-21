import type { IFileSystem } from '@baishou/core-mobile'
import type {
  SyncProgressEvent,
  SyncManifest,
  S3SyncConfig,
  ManifestEntry,
  IncrementalSyncRunOptions
} from '@baishou/shared'
import {
  assertBidirectionalSyncDivergenceAllowed,
  buildIncrementalSyncPlanPreview,
  getIncrementalSyncStorageId,
  inspectDeletePropagationBlock,
  isSyncDivergenceConfirmationRequiredError,
  limitExecute,
  resolveIncrementalSyncStorageHistory,
  resolveSyncMergeDecisions,
  type IncrementalSyncStorageHistory,
  SYNC_MANIFEST_FILENAME,
  SYNC_MANIFEST_VERSION,
  SYNC_REMOTE_SNAPSHOT_FILENAME,
  SYNC_STORAGE_ID_FILENAME,
  threeWayMerge,
  type IncrementalSyncPlanPreview
} from '@baishou/shared'
import {
  shouldIncludeIncrementalSyncFile,
  shouldScanIncrementalSyncDirectory
} from '@baishou/shared'
import type { IStoragePathService } from '@baishou/core-mobile'
import { getAppCacheDirectory } from './mobile-app-paths'
import { MobileIncrementalCloudClient } from './mobile-incremental-cloud.client'
import { md5HexForSyncFile } from './mobile-sync-file-md5.util'

export type MobileIncrementalProgress = Partial<
  Pick<SyncProgressEvent, 'phase' | 'fileName' | 'action' | 'statusText'>
> & {
  current: number
  total: number
}

type IncrementalProgressCallback = (progress: MobileIncrementalProgress) => void

/** 目录扫描并发度（同级多目录并行展开） */
const SCAN_DIR_CONCURRENCY = 8
/** 单目录内 stat 并发度 */
const SCAN_STAT_CONCURRENCY = 32
/** 本地 manifest 哈希并发度 */
const MANIFEST_HASH_CONCURRENCY = 12

type ScannedSyncFile = {
  relPath: string
  fullPath: string
  size: number
  mtimeMs: number
}

function mapDecisionProgress(
  completed: number,
  total: number,
  d: ReturnType<typeof threeWayMerge>[number]
): MobileIncrementalProgress {
  const base: MobileIncrementalProgress = {
    phase: 'syncing',
    current: completed,
    total,
    fileName: d.filePath
  }
  switch (d.type) {
    case 'upload':
      return { ...base, action: 'upload' }
    case 'download':
      return { ...base, action: 'download' }
    case 'delete-remote':
    case 'delete-local':
      return { ...base, action: 'delete' }
    case 'skip':
      return { ...base, action: 'skip' }
    case 'conflict-resolved':
      return { ...base, action: d.direction === 'upload' ? 'upload' : 'download' }
    default:
      return base
  }
}

export type MobileIncrementalSyncOutcome = {
  uploaded: number
  downloaded: number
  conflicts: number
  skipped: number
  deletedRemote: number
  deletedLocal: number
  failed: number
  failedPaths: string[]
}

function joinPath(...parts: string[]): string {
  return parts
    .map((p, i) => {
      if (i === 0) return p.replace(/\/$/, '')
      return p.replace(/^\//, '').replace(/\/$/, '')
    })
    .filter(Boolean)
    .join('/')
}

async function scanIncrementalSyncFiles(
  fileSystem: IFileSystem,
  syncRoot: string,
  onProgress?: (discovered: number, fileName: string) => void
): Promise<ScannedSyncFile[]> {
  const files: ScannedSyncFile[] = []
  const queue: Array<{ dir: string; rel: string }> = [{ dir: syncRoot, rel: '' }]

  while (queue.length > 0) {
    const batch = queue.splice(0, SCAN_DIR_CONCURRENCY)
    await Promise.all(
      batch.map(async ({ dir, rel }) => {
        let names: string[]
        try {
          names = await fileSystem.readdir(dir)
        } catch {
          return
        }

        const entries = await limitExecute(names, SCAN_STAT_CONCURRENCY, async (name) => {
          const full = joinPath(dir, name)
          const relPath = rel ? joinPath(rel, name) : name
          const info = await fileSystem.stat(full).catch(() => null)
          return { name, full, relPath, info }
        })

        for (const entry of entries) {
          if (!entry?.info) continue
          if (entry.info.isDirectory) {
            if (shouldScanIncrementalSyncDirectory(entry.name, entry.relPath)) {
              queue.push({ dir: entry.full, rel: entry.relPath })
            }
            continue
          }
          if (!entry.info.isFile || !shouldIncludeIncrementalSyncFile(entry.name, entry.relPath)) {
            continue
          }
          files.push({
            relPath: entry.relPath,
            fullPath: entry.full,
            size: entry.info.size ?? 0,
            mtimeMs: entry.info.mtimeMs ?? Date.now()
          })
          if (files.length % 10 === 0) {
            onProgress?.(files.length, entry.relPath)
          }
        }
      })
    )
  }

  if (files.length > 0) {
    onProgress?.(files.length, files[files.length - 1]!.relPath)
  }
  return files
}

export class MobileIncrementalEngine {
  private lastConflicts: string[] = []

  constructor(
    private readonly pathService: IStoragePathService,
    private readonly fileSystem: IFileSystem,
    private readonly deviceId: string
  ) {}

  getLastConflicts(): string[] {
    return [...this.lastConflicts]
  }

  private async syncRoot(): Promise<string> {
    return this.pathService.getRootDirectory()
  }

  private async syncMetaDir(): Promise<string> {
    return `${await this.syncRoot()}/.baishou`
  }

  private manifestPath(metaDir: string): string {
    return joinPath(metaDir, SYNC_MANIFEST_FILENAME)
  }

  private snapshotPath(metaDir: string): string {
    return joinPath(metaDir, SYNC_REMOTE_SNAPSHOT_FILENAME)
  }

  async buildLocalManifest(
    onProgress?: (current: number, total: number, fileName: string) => void
  ): Promise<SyncManifest> {
    const syncRoot = await this.syncRoot()
    const cachedManifest = await this.readLocalManifestFile().catch(() => this.emptyManifest())

    const files = await scanIncrementalSyncFiles(this.fileSystem, syncRoot, (discovered, fileName) => {
      onProgress?.(0, discovered, fileName)
    })

    const manifest: SyncManifest = {
      version: SYNC_MANIFEST_VERSION,
      updatedAt: Date.now(),
      deviceId: this.deviceId,
      files: {}
    }

    const total = Math.max(files.length, 1)
    let hashedCount = 0
    await limitExecute(files, MANIFEST_HASH_CONCURRENCY, async (scanned) => {
      try {
        const cached = cachedManifest.files[scanned.relPath]
        if (cached?.hash && cached.size === scanned.size && cached.lastModified === scanned.mtimeMs) {
          manifest.files[scanned.relPath] = cached
        } else {
          const hash = await md5HexForSyncFile(this.fileSystem, scanned.fullPath)
          manifest.files[scanned.relPath] = {
            hash,
            size: scanned.size,
            lastModified: scanned.mtimeMs
          }
        }
      } catch {
        // skip unreadable
      }
      hashedCount++
      if (hashedCount % 4 === 0 || hashedCount === files.length) {
        onProgress?.(hashedCount, total, scanned.relPath)
      }
    })
    if (files.length > 0) {
      onProgress?.(files.length, total, files[files.length - 1]!.relPath)
    }
    return manifest
  }

  async saveLocalManifest(manifest: SyncManifest): Promise<void> {
    const metaDir = await this.syncMetaDir()
    const mp = this.manifestPath(metaDir)
    if (!(await this.fileSystem.exists(metaDir))) {
      await this.fileSystem.mkdir(metaDir, { recursive: true })
    }
    await this.fileSystem.writeFile(mp, JSON.stringify(manifest, null, 2))
  }

  private storageIdPath(metaDir: string): string {
    return joinPath(metaDir, SYNC_STORAGE_ID_FILENAME)
  }

  private emptyManifest(): SyncManifest {
    return { version: SYNC_MANIFEST_VERSION, updatedAt: 0, deviceId: '', files: {} }
  }

  private async readLocalManifestFile(): Promise<SyncManifest> {
    const metaDir = await this.syncMetaDir()
    const mp = this.manifestPath(metaDir)
    if (!(await this.fileSystem.exists(mp))) {
      return this.emptyManifest()
    }
    const raw = await this.fileSystem.readFile(mp)
    return JSON.parse(raw) as SyncManifest
  }

  private async getSyncStorageHistoryState(
    config: S3SyncConfig
  ): Promise<IncrementalSyncStorageHistory> {
    const metaDir = await this.syncMetaDir()
    const storageIdPath = this.storageIdPath(metaDir)
    if (!(await this.fileSystem.exists(storageIdPath))) {
      return 'none'
    }
    try {
      const savedId = (await this.fileSystem.readFile(storageIdPath)).trim()
      return resolveIncrementalSyncStorageHistory(savedId, config)
    } catch {
      return 'mismatch'
    }
  }

  async loadRemoteSnapshot(config: S3SyncConfig): Promise<SyncManifest> {
    const metaDir = await this.syncMetaDir()
    const sp = this.snapshotPath(metaDir)
    if (!(await this.fileSystem.exists(sp))) {
      return this.emptyManifest()
    }

    const storageIdPath = this.storageIdPath(metaDir)
    const currentStorageId = getIncrementalSyncStorageId(config)
    if (await this.fileSystem.exists(storageIdPath)) {
      try {
        const savedId = (await this.fileSystem.readFile(storageIdPath)).trim()
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
      return JSON.parse(await this.fileSystem.readFile(sp)) as SyncManifest
    } catch {
      return this.emptyManifest()
    }
  }

  async saveRemoteSnapshot(manifest: SyncManifest, config: S3SyncConfig): Promise<void> {
    const metaDir = await this.syncMetaDir()
    const sp = this.snapshotPath(metaDir)
    if (!(await this.fileSystem.exists(metaDir))) {
      await this.fileSystem.mkdir(metaDir, { recursive: true })
    }
    await this.fileSystem.writeFile(sp, JSON.stringify(manifest, null, 2))
    await this.fileSystem.writeFile(
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
    const raw = await this.fileSystem.readFile(temp)
    await this.fileSystem.unlink(temp)
    const manifest = JSON.parse(raw) as SyncManifest

    if (manifest?.files) {
      const cleanFiles: Record<string, ManifestEntry> = {}
      for (const [relPath, entry] of Object.entries(manifest.files)) {
        const normalizedPath = relPath.replace(/\\/g, '/')
        if (actualFilesSet.has(normalizedPath)) {
          cleanFiles[normalizedPath] = entry
        }
      }
      manifest.files = cleanFiles
    }

    return manifest
  }

  private async backupLocalFile(syncRoot: string, relPath: string): Promise<void> {
    const src = joinPath(syncRoot, relPath)
    if (!(await this.fileSystem.exists(src))) return
    const backupFile = joinPath(syncRoot, '.versions', relPath, `${Date.now()}.bak`)
    const bdir = backupFile.replace(/\/[^/]+$/, '')
    if (!(await this.fileSystem.exists(bdir))) {
      await this.fileSystem.mkdir(bdir, { recursive: true })
    }
    await this.fileSystem.copyFile(src, backupFile)
  }

  /**
   * 三向合并增量同步（对齐桌面 ThreeWaySyncService.sync）
   */
  async syncThreeWay(
    config: S3SyncConfig,
    onProgress?: IncrementalProgressCallback,
    runOptions?: IncrementalSyncRunOptions
  ): Promise<MobileIncrementalSyncOutcome> {
    const syncRoot = await this.syncRoot()
    const metaDir = await this.syncMetaDir()
    const client = new MobileIncrementalCloudClient(config, this.fileSystem)
    client.setVaultPath(syncRoot)

    onProgress?.({ phase: 'scanning', current: 0, total: 0 })
    const localManifest = await this.buildLocalManifest((current, total, fileName) => {
      onProgress?.({ phase: 'scanning', current, total, fileName })
    })

    onProgress?.({ phase: 'comparing', current: 0, total: 1 })
    const remoteManifest = await this.getRemoteManifest(client, (current, total, fileName) => {
      onProgress?.({ phase: 'comparing', current, total, fileName })
    })
    onProgress?.({ phase: 'comparing', current: 1, total: 1 })
    const storageHistory = await this.getSyncStorageHistoryState(config)
    assertBidirectionalSyncDivergenceAllowed(localManifest, remoteManifest, config, {
      storageHistory,
      highDivergenceConfirmed: runOptions?.highDivergenceConfirmed
    })
    const ancestorSnapshot = await this.loadRemoteSnapshot(config)
    const previousLocalManifest = await this.readLocalManifestFile().catch(() =>
      this.emptyManifest()
    )

    const decisions = resolveSyncMergeDecisions(
      threeWayMerge(localManifest, remoteManifest, ancestorSnapshot),
      localManifest,
      remoteManifest,
      ancestorSnapshot,
      previousLocalManifest,
      { deletePropagationChoice: runOptions?.deletePropagationChoice }
    )

    let uploaded = 0
    let downloaded = 0
    let skipped = 0
    let deletedRemote = 0
    let deletedLocal = 0
    const conflicted: string[] = []
    const failures: string[] = []

    const fileConcurrency = config.fileConcurrency || 5
    let completed = 0

    await limitExecute(decisions, fileConcurrency, async (d) => {
      completed++
      if (d.type !== 'skip' || completed === decisions.length || completed % 24 === 0) {
        onProgress?.(mapDecisionProgress(completed, decisions.length, d))
      }
      try {
        switch (d.type) {
          case 'upload':
            await client.uploadFile(joinPath(syncRoot, d.filePath))
            uploaded++
            break
          case 'download':
            await client.downloadFile(d.filePath, joinPath(syncRoot, d.filePath))
            downloaded++
            break
          case 'delete-remote':
            await client.deleteFile(d.filePath)
            deletedRemote++
            break
          case 'delete-local': {
            const fp = joinPath(syncRoot, d.filePath)
            await this.fileSystem.unlink(fp)
            deletedLocal++
            break
          }
          case 'conflict-resolved':
            conflicted.push(d.filePath)
            if (d.direction === 'upload') {
              await this.backupLocalFile(syncRoot, d.filePath)
              await client.uploadFile(joinPath(syncRoot, d.filePath))
              uploaded++
            } else {
              await this.backupLocalFile(syncRoot, d.filePath)
              await client.downloadFile(d.filePath, joinPath(syncRoot, d.filePath))
              downloaded++
            }
            break
          case 'skip':
            skipped++
            break
        }
      } catch (e) {
        failures.push(d.filePath)
        console.warn(`[MobileIncremental] decision failed for ${d.filePath}`, e)
      }
    })

    const hadMutations = uploaded + downloaded + deletedRemote + deletedLocal > 0
    if (failures.length > 0 && !hadMutations) {
      const preview = failures.slice(0, 3).join(', ')
      const suffix = failures.length > 3 ? '...' : ''
      throw new Error(`Sync failed for ${failures.length} file(s): ${preview}${suffix}`)
    }
    if (failures.length > 0) {
      console.warn(
        `[MobileIncremental] ${failures.length} file(s) failed; continuing with partial sync`
      )
    }

    this.lastConflicts = conflicted
    onProgress?.({ phase: 'finalizing', current: 0, total: 1 })
    const finalManifest = await this.buildLocalManifest()
    await this.saveLocalManifest(finalManifest)
    await client.uploadFile(this.manifestPath(metaDir))
    await this.saveRemoteSnapshot(finalManifest, config)
    onProgress?.({ phase: 'finalizing', current: 1, total: 1 })

    return {
      uploaded,
      downloaded,
      conflicts: conflicted.length,
      skipped,
      deletedRemote,
      deletedLocal,
      failed: failures.length,
      failedPaths: failures
    }
  }

  /** 仅上传本地变更（对齐桌面 uploadOnly） */
  async uploadOnly(
    config: S3SyncConfig,
    onProgress?: IncrementalProgressCallback
  ): Promise<MobileIncrementalSyncOutcome> {
    const syncRoot = await this.syncRoot()
    const metaDir = await this.syncMetaDir()
    const client = new MobileIncrementalCloudClient(config, this.fileSystem)
    client.setVaultPath(syncRoot)

    onProgress?.({ phase: 'scanning', current: 0, total: 0 })
    const localManifest = await this.buildLocalManifest((current, total, fileName) => {
      onProgress?.({ phase: 'scanning', current, total, fileName })
    })
    onProgress?.({ phase: 'comparing', current: 0, total: 1 })
    const remoteManifest = await this.getRemoteManifest(client, (current, total, fileName) => {
      onProgress?.({ phase: 'comparing', current, total, fileName })
    })
    onProgress?.({ phase: 'comparing', current: 1, total: 1 })
    const entries = Object.entries(localManifest.files)

    let uploaded = 0
    let skipped = 0
    const fileConcurrency = config.fileConcurrency || 5
    let completed = 0

    await limitExecute(entries, fileConcurrency, async ([relPath, localEntry]) => {
      completed++
      onProgress?.({
        phase: 'syncing',
        current: completed,
        total: entries.length,
        fileName: relPath,
        action: 'upload'
      })
      const remoteEntry = remoteManifest.files[relPath]
      if (!remoteEntry || remoteEntry.hash !== localEntry.hash) {
        await client.uploadFile(joinPath(syncRoot, relPath))
        uploaded++
      } else {
        skipped++
      }
    })

    await this.saveLocalManifest(localManifest)
    await client.uploadFile(this.manifestPath(metaDir))
    await this.saveRemoteSnapshot(localManifest, config)

    return {
      uploaded,
      downloaded: 0,
      conflicts: 0,
      skipped,
      deletedRemote: 0,
      deletedLocal: 0,
      failed: 0,
      failedPaths: []
    }
  }

  /** 仅下载远程变更（对齐桌面 downloadOnly，含三向删除传播中的 download） */
  async downloadOnly(
    config: S3SyncConfig,
    onProgress?: IncrementalProgressCallback,
    runOptions?: IncrementalSyncRunOptions
  ): Promise<MobileIncrementalSyncOutcome> {
    const syncRoot = await this.syncRoot()
    const metaDir = await this.syncMetaDir()
    const client = new MobileIncrementalCloudClient(config, this.fileSystem)
    client.setVaultPath(syncRoot)

    onProgress?.({ phase: 'scanning', current: 0, total: 0 })
    const localManifest = await this.buildLocalManifest((current, total, fileName) => {
      onProgress?.({ phase: 'scanning', current, total, fileName })
    })
    onProgress?.({ phase: 'comparing', current: 0, total: 1 })
    const remoteManifest = await this.getRemoteManifest(client, (current, total, fileName) => {
      onProgress?.({ phase: 'comparing', current, total, fileName })
    })
    onProgress?.({ phase: 'comparing', current: 1, total: 1 })
    const storageHistory = await this.getSyncStorageHistoryState(config)
    assertBidirectionalSyncDivergenceAllowed(localManifest, remoteManifest, config, {
      storageHistory,
      highDivergenceConfirmed: runOptions?.highDivergenceConfirmed
    })
    const ancestorSnapshot = await this.loadRemoteSnapshot(config)
    const decisions = threeWayMerge(localManifest, remoteManifest, ancestorSnapshot)

    let downloaded = 0
    let skipped = 0
    const fileConcurrency = config.fileConcurrency || 5
    let completed = 0

    await limitExecute(decisions, fileConcurrency, async (d) => {
      completed++
      if (d.type !== 'skip' || completed === decisions.length || completed % 24 === 0) {
        onProgress?.(mapDecisionProgress(completed, decisions.length, d))
      }
      if (d.type === 'download' || (d.type === 'conflict-resolved' && d.direction === 'download')) {
        await client.downloadFile(d.filePath, joinPath(syncRoot, d.filePath))
        downloaded++
      } else if (d.type === 'skip') {
        skipped++
      }
    })

    const finalManifest = await this.buildLocalManifest()
    await this.saveLocalManifest(finalManifest)
    await client.uploadFile(this.manifestPath(metaDir))
    await this.saveRemoteSnapshot(finalManifest, config)

    return {
      uploaded: 0,
      downloaded,
      conflicts: 0,
      skipped,
      deletedRemote: 0,
      deletedLocal: 0,
      failed: 0,
      failedPaths: []
    }
  }

  async planSync(
    config: S3SyncConfig,
    context: {
      registeredVaults: string[]
      diskVaultNames: string[]
      activeVaultName: string | null
    },
    runOptions?: IncrementalSyncRunOptions,
    onProgress?: IncrementalProgressCallback
  ): Promise<IncrementalSyncPlanPreview> {
    const syncRoot = await this.syncRoot()
    const client = new MobileIncrementalCloudClient(config, this.fileSystem)
    client.setVaultPath(syncRoot)

    onProgress?.({ phase: 'scanning', current: 0, total: 0 })
    const localManifest = await this.buildLocalManifest((current, total, fileName) => {
      onProgress?.({ phase: 'scanning', current, total, fileName })
    })
    onProgress?.({ phase: 'comparing', current: 0, total: 1 })
    const remoteManifest = await this.getRemoteManifest(client, (current, total, fileName) => {
      onProgress?.({ phase: 'comparing', current, total, fileName })
    })
    onProgress?.({ phase: 'comparing', current: 1, total: 1 })

    const storageHistory = await this.getSyncStorageHistoryState(config)

    let requiresHighDivergenceConfirm = false
    let divergencePercent: number | undefined
    let maxDivergencePercent: number | undefined

    try {
      assertBidirectionalSyncDivergenceAllowed(localManifest, remoteManifest, config, {
        storageHistory,
        highDivergenceConfirmed: runOptions?.highDivergenceConfirmed
      })
    } catch (error) {
      if (isSyncDivergenceConfirmationRequiredError(error)) {
        requiresHighDivergenceConfirm = true
        divergencePercent = error.divergencePercent
        maxDivergencePercent = error.maxDivergencePercent
      } else {
        throw error
      }
    }

    const ancestorSnapshot = await this.loadRemoteSnapshot(config)
    const previousLocalManifest = await this.readLocalManifestFile().catch(() => this.emptyManifest())
    const decisions = threeWayMerge(localManifest, remoteManifest, ancestorSnapshot)

    const deleteBlock = inspectDeletePropagationBlock(
      decisions,
      localManifest,
      remoteManifest,
      ancestorSnapshot,
      previousLocalManifest
    )

    return buildIncrementalSyncPlanPreview({
      decisions,
      registeredVaults: context.registeredVaults,
      diskVaultNames: context.diskVaultNames,
      activeVaultName: context.activeVaultName,
      requiresHighDivergenceConfirm,
      divergencePercent,
      maxDivergencePercent,
      deletePropagationBlocked: deleteBlock != null,
      deletePropagationReason: deleteBlock?.reason,
      blockedDeleteCount: deleteBlock?.deleteCount,
      blockedDeleteDirection: deleteBlock?.direction
    })
  }
}
