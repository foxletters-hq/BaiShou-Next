import type { IFileSystem } from '@baishou/core-mobile'
import type {
  SyncProgressEvent,
  SyncManifest,
  S3SyncConfig,
  ManifestEntry,
  IncrementalSyncRunOptions,
  MergeDecision
} from '@baishou/shared'
import {
  assertBidirectionalSyncDivergenceAllowed,
  buildIncrementalSyncPlanPreview,
  collectManifestVaultScopes,
  getIncrementalSyncStorageId,
  buildIncrementalSyncPlanMergeResult,
  buildIncrementalSyncPlanReuseBaseline,
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
  type IncrementalSyncPlanPreview,
  applySyncDecisionRemovedSideEffects,
  createEmptySyncManifest,
  finalizeIncrementalSyncManifest,
  getSyncManifestRemovedMap,
  normalizeSyncManifest,
  reconcileSyncManifestRemovedWithRemoteFiles,
  isIncrementalSyncRemoteFileNotFoundError
} from '@baishou/shared'
import type { IStoragePathService } from '@baishou/core-mobile'
import { getAppCacheDirectory } from './mobile-app-paths'
import { MobileIncrementalCloudClient } from './mobile-incremental-cloud.client'
import { throwIfIncrementalSyncAborted } from './mobile-incremental-sync-abort.util'
import { md5HexForSyncFile } from './mobile-sync-file-md5.util'
import { sortSyncDecisionsBySizeAsc } from './mobile-incremental-sync-order.util'
import { normalizeSyncFilePath } from './android-external-fs'
import {
  clearIncrementalSyncSession,
  isInterruptedSyncSessionResumable,
  readIncrementalSyncSession,
  shouldClearInterruptedSyncSessionOnPlan,
  writeIncrementalSyncSession,
  type IncrementalSyncSessionMode
} from './mobile-incremental-sync-session.util'
import { IncrementalManifestCommitQueue } from './mobile-incremental-manifest-commit.util'
import {
  IncrementalSyncCheckpointCoordinator,
  type SessionTouchState
} from './mobile-incremental-flush.util'
import { scanIncrementalSyncFilesForManifest } from './mobile-incremental-sync-scan.util'
import { resolveMobileIncrementalSyncFullPath } from './mobile-incremental-sync-path.util'
import { loadVaultExternalSyncMounts, type VaultExternalSyncMount } from '@baishou/core-mobile'
import {
  resolveSyncFileConcurrencyFromDecisions,
  shouldTrustRemoteHashAfterDownload
} from './mobile-incremental-sync-progress.util'

export type MobileIncrementalProgress = Partial<
  Pick<
    SyncProgressEvent,
    'phase' | 'fileName' | 'action' | 'statusText' | 'fileBytesDone' | 'fileBytesTotal'
  >
> & {
  current: number
  total: number
}

type IncrementalProgressCallback = (progress: MobileIncrementalProgress) => void

/** 本地 manifest 哈希并发度（原生 MD5 以 I/O 为主，可适当提高） */
const MANIFEST_HASH_CONCURRENCY = 16

const SYNC_ACTIVITY_STATUS: Record<string, string> = {
  preparing: '正在连接…',
  reading: '正在读取文件…',
  uploading: '正在上传…',
  downloading: '正在下载…',
  writing: '正在写入磁盘…',
  checkpointing: '正在保存同步进度…'
}

function syncActivityStatusText(activity: string): string | undefined {
  return SYNC_ACTIVITY_STATUS[activity]
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

export type MobileIncrementalExecutionContext = {
  signal?: AbortSignal
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

export class MobileIncrementalEngine {
  private lastConflicts: string[] = []
  /** 串行化远端 manifest 上传，避免并发 worker 同时写同一路径 */
  private manifestUploadQueue: Promise<void> = Promise.resolve()
  /** 单次「规划同步」内复用本地/远端 manifest，避免重复全量扫描 */
  private planManifestCache: { local: SyncManifest; remote: SyncManifest } | null = null
  /** 用户确认规划后、执行同步前复用的本地 manifest（跳过一次全量扫描） */
  private pendingSyncLocalManifest: SyncManifest | null = null
  /** 用户确认规划后、执行同步前复用的远端 manifest（跳过一次远端拉取） */
  private pendingSyncRemoteManifest: SyncManifest | null = null
  private manifestCommitQueue = new IncrementalManifestCommitQueue()
  private externalSyncMounts: VaultExternalSyncMount[] | null = null

  constructor(
    private readonly pathService: IStoragePathService,
    private readonly fileSystem: IFileSystem,
    private readonly deviceId: string
  ) {}

  getLastConflicts(): string[] {
    return [...this.lastConflicts]
  }

  private invalidateExternalSyncMounts(): void {
    this.externalSyncMounts = null
  }

  private async getExternalSyncMounts(syncRoot: string): Promise<VaultExternalSyncMount[]> {
    if (!this.externalSyncMounts) {
      this.externalSyncMounts = await loadVaultExternalSyncMounts(this.fileSystem, syncRoot)
    }
    return this.externalSyncMounts
  }

  private async resolveSyncFullPath(syncRoot: string, relPath: string): Promise<string> {
    const mounts = await this.getExternalSyncMounts(syncRoot)
    return resolveMobileIncrementalSyncFullPath(
      this.fileSystem,
      syncRoot,
      relPath,
      mounts
    )
  }

  beginPlanSession(): void {
    this.planManifestCache = null
    this.pendingSyncLocalManifest = null
    this.pendingSyncRemoteManifest = null
  }

  endPlanSession(): void {
    this.planManifestCache = null
    this.pendingSyncLocalManifest = null
    this.pendingSyncRemoteManifest = null
  }

  /** 规划结束：保留本地/远端 manifest 供随后执行同步复用，并落盘本地 manifest 供下次规划跳过未变更文件的哈希 */
  finalizePlanSession(): void {
    if (this.planManifestCache?.local) {
      this.pendingSyncLocalManifest = this.planManifestCache.local
      this.pendingSyncRemoteManifest = this.planManifestCache.remote
      void this.saveLocalManifest(this.planManifestCache.local).catch((error: unknown) => {
        console.warn(
          '[MobileIncremental] save local manifest after plan failed:',
          error instanceof Error ? error.message : String(error)
        )
      })
    }
    this.planManifestCache = null
  }

  private takePendingSyncLocalManifest(): SyncManifest | null {
    const manifest = this.pendingSyncLocalManifest
    this.pendingSyncLocalManifest = null
    return manifest
  }

  private takePendingSyncRemoteManifest(): SyncManifest | null {
    const manifest = this.pendingSyncRemoteManifest
    this.pendingSyncRemoteManifest = null
    return manifest
  }

  /** 规划完成后、执行前读取缓存的本地 manifest（不消费） */
  peekPendingSyncLocalManifest(): SyncManifest | null {
    return this.pendingSyncLocalManifest
  }

  /** 规划完成后、执行前读取缓存的远端 manifest（不消费） */
  peekPendingSyncRemoteManifest(): SyncManifest | null {
    return this.pendingSyncRemoteManifest
  }

  private async loadPlanManifests(
    config: S3SyncConfig,
    onProgress?: IncrementalProgressCallback
  ): Promise<{ local: SyncManifest; remote: SyncManifest }> {
    if (this.planManifestCache) {
      return this.planManifestCache
    }

    const syncRoot = await this.syncRoot()
    const client = new MobileIncrementalCloudClient(config, this.fileSystem)
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

    this.planManifestCache = { local, remote }
    return this.planManifestCache
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

  private enqueueRemoteManifestUpload(
    metaDir: string,
    client: MobileIncrementalCloudClient
  ): Promise<void> {
    const task = this.manifestUploadQueue
      .catch(() => {})
      .then(() => client.uploadFile(this.manifestPath(metaDir)))
    this.manifestUploadQueue = task
    return task
  }

  private snapshotPath(metaDir: string): string {
    return joinPath(metaDir, SYNC_REMOTE_SNAPSHOT_FILENAME)
  }

  async buildLocalManifest(
    onProgress?: (current: number, total: number, fileName: string) => void
  ): Promise<SyncManifest> {
    const syncRoot = await this.syncRoot()
    const diskCached = await this.readLocalManifestFile().catch(() => this.emptyManifest())
    const cachedManifest = this.mergeManifestFileCaches(
      diskCached,
      this.pendingSyncLocalManifest,
      this.planManifestCache?.local
    )

    const files = await scanIncrementalSyncFilesForManifest(this.fileSystem, syncRoot, (discovered, fileName) => {
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

  /** 同步结束后增量刷新 manifest，避免全量重扫 + 重哈希 */
  private async finalizeManifestAfterSync(
    baseManifest: SyncManifest,
    decisions: MergeDecision[],
    syncRoot: string,
    onProgress?: IncrementalProgressCallback
  ): Promise<SyncManifest> {
    const manifest: SyncManifest = {
      ...baseManifest,
      updatedAt: Date.now(),
      files: { ...baseManifest.files }
    }

    const pathsToRehash: string[] = []
    for (const d of decisions) {
      if (d.type === 'delete-local') {
        delete manifest.files[d.filePath]
        continue
      }
      if (d.type === 'download') {
        pathsToRehash.push(d.filePath)
        continue
      }
      if (d.type === 'conflict-resolved' && d.direction === 'download') {
        pathsToRehash.push(d.filePath)
      }
    }

    if (pathsToRehash.length === 0) {
      return manifest
    }

    const total = pathsToRehash.length
    let done = 0
    await limitExecute(pathsToRehash, MANIFEST_HASH_CONCURRENCY, async (relPath) => {
      const fullPath = await this.resolveSyncFullPath(syncRoot, relPath)
      const stat = await this.fileSystem.stat(fullPath).catch(() => null)
      if (!stat?.isFile) {
        delete manifest.files[relPath]
        return
      }
      const hash = await md5HexForSyncFile(this.fileSystem, fullPath)
      manifest.files[relPath] = {
        hash,
        size: stat.size ?? 0,
        lastModified: stat.mtimeMs ?? Date.now()
      }
      done++
      if (done % 4 === 0 || done === total) {
        onProgress?.({
          phase: 'finalizing',
          current: done,
          total,
          fileName: relPath
        })
      }
    })

    return manifest
  }

  /** 将单文件同步结果合并进 manifest（用于断点续传 checkpoint） */
  private async applyDecisionToManifest(
    manifest: SyncManifest,
    decision: MergeDecision,
    syncRoot: string
  ): Promise<SyncManifest> {
    const next: SyncManifest = {
      ...manifest,
      updatedAt: Date.now(),
      deviceId: manifest.deviceId || this.deviceId,
      files: { ...manifest.files }
    }

    const applyDownloadedEntry = async (relPath: string, remoteEntry: ManifestEntry | null) => {
      const fullPath = await this.resolveSyncFullPath(syncRoot, relPath)
      const stat = await this.fileSystem.stat(fullPath).catch(() => null)
      if (!stat?.isFile) {
        delete next.files[relPath]
        return
      }
      if (remoteEntry && shouldTrustRemoteHashAfterDownload(stat.size ?? 0, remoteEntry)) {
        next.files[relPath] = {
          hash: remoteEntry.hash,
          size: stat.size ?? remoteEntry.size,
          lastModified: stat.mtimeMs ?? remoteEntry.lastModified
        }
        return
      }
      const hash = await md5HexForSyncFile(this.fileSystem, fullPath)
      next.files[relPath] = {
        hash,
        size: stat.size ?? 0,
        lastModified: stat.mtimeMs ?? Date.now()
      }
    }

    switch (decision.type) {
      case 'upload':
        if (decision.localEntry) next.files[decision.filePath] = decision.localEntry
        break
      case 'download':
        await applyDownloadedEntry(decision.filePath, decision.remoteEntry)
        break
      case 'delete-local':
      case 'delete-remote':
        delete next.files[decision.filePath]
        break
      case 'conflict-resolved':
        if (decision.direction === 'upload' && decision.localEntry) {
          next.files[decision.filePath] = decision.localEntry
        } else if (decision.direction === 'download') {
          await applyDownloadedEntry(decision.filePath, decision.remoteEntry)
        }
        break
      default:
        break
    }

    return applySyncDecisionRemovedSideEffects(next, decision, this.deviceId)
  }

  private async flushRemoteManifestCheckpoint(
    metaDir: string,
    client: MobileIncrementalCloudClient
  ): Promise<void> {
    await this.enqueueRemoteManifestUpload(metaDir, client)
  }

  private async touchSyncSession(
    metaDir: string,
    mode: IncrementalSyncSessionMode,
    total: number,
    completed: number,
    lastFile?: string,
    startedAt?: number
  ): Promise<void> {
    const now = Date.now()
    await writeIncrementalSyncSession(this.fileSystem, metaDir, {
      startedAt: startedAt ?? now,
      updatedAt: now,
      total,
      completed,
      lastFile,
      mode
    })
  }

  private createCheckpointRuntime(
    metaDir: string,
    client: MobileIncrementalCloudClient,
    config: S3SyncConfig
  ) {
    const coordinator = new IncrementalSyncCheckpointCoordinator()
    const saveLocal = (manifest: SyncManifest) => this.saveLocalManifest(manifest)
    const saveSnapshot = (manifest: SyncManifest) => this.saveRemoteSnapshot(manifest, config)
    const uploadRemote = () => this.flushRemoteManifestCheckpoint(metaDir, client)
    const writeSession = (state: SessionTouchState) =>
      this.touchSyncSession(
        state.metaDir,
        state.mode,
        state.total,
        state.completed,
        state.lastFile,
        state.startedAt
      )
    const ensureLocalFlushed = () =>
      coordinator.flushLocalIfNeeded(true, saveLocal, saveSnapshot)

    return {
      async afterMutation(manifest: SyncManifest) {
        coordinator.noteManifest(manifest)
        coordinator.noteRemoteCheckpoint()
        await coordinator.flushLocalIfNeeded(false, saveLocal, saveSnapshot)
        await coordinator.flushRemoteIfNeeded(false, uploadRemote, ensureLocalFlushed)
      },
      async afterDecisionProgress(session: SessionTouchState) {
        coordinator.noteSession(session)
        await coordinator.flushSessionIfNeeded(false, async (state) => {
          await ensureLocalFlushed()
          await writeSession(state)
        })
      },
      async finalize(manifest: SyncManifest, session?: SessionTouchState) {
        if (session) coordinator.noteSession(session)
        coordinator.noteManifest(manifest)
        await coordinator.finalizeAll(saveLocal, saveSnapshot, uploadRemote, async (state) => {
          await ensureLocalFlushed()
          await writeSession(state)
        })
      }
    }
  }

  private resolveInFlightTransfer(
    inFlight: Map<string, { relPath: string; action: MobileIncrementalProgress['action'] }>,
    filePath: string
  ) {
    const normalized = normalizeSyncFilePath(filePath)
    const direct = inFlight.get(filePath) ?? inFlight.get(normalized)
    if (direct) return direct
    for (const [key, info] of inFlight) {
      if (normalizeSyncFilePath(key) === normalized) return info
    }
    return undefined
  }

  private emitFileTransferStart(
    onProgress: IncrementalProgressCallback | undefined,
    completed: number,
    total: number,
    filePath: string,
    action: MobileIncrementalProgress['action'],
    fileBytesTotal?: number
  ) {
    if (action !== 'upload' && action !== 'download') return
    onProgress?.({
      phase: 'syncing',
      current: completed,
      total,
      fileName: filePath,
      action,
      fileBytesDone: 0,
      fileBytesTotal: fileBytesTotal && fileBytesTotal > 0 ? fileBytesTotal : undefined,
      statusText: action === 'upload' ? '正在上传…' : '正在下载…'
    })
  }

  private bindTransferProgress(
    client: MobileIncrementalCloudClient,
    onProgress: IncrementalProgressCallback | undefined,
    getCompleted: () => number,
    total: number,
    inFlight: Map<string, { relPath: string; action: MobileIncrementalProgress['action'] }>
  ): (relPath: string) => { done: number; total: number } | undefined {
    const lastByteProgress = new Map<string, { done: number; total: number }>()

    const publish = (payload: MobileIncrementalProgress) => {
      onProgress?.(payload)
    }

    client.setTransferProgressCallback((bytesDone, bytesTotal, filePath) => {
      const info = this.resolveInFlightTransfer(inFlight, filePath)
      if (!info || bytesTotal <= 0) return
      lastByteProgress.set(info.relPath, { done: bytesDone, total: bytesTotal })
      publish({
        phase: 'syncing',
        current: getCompleted(),
        total,
        fileName: info.relPath,
        action: info.action,
        fileBytesDone: bytesDone,
        fileBytesTotal: bytesTotal,
        statusText:
          info.action === 'upload'
            ? '正在上传…'
            : info.action === 'download'
              ? '正在下载…'
              : undefined
      })
    })
    client.setTransferActivityCallback((activity, filePath) => {
      const info = this.resolveInFlightTransfer(inFlight, filePath)
      if (!info) return
      const statusText = syncActivityStatusText(activity)
      if (!statusText) return
      const bytes = lastByteProgress.get(info.relPath)
      publish({
        phase: 'syncing',
        current: getCompleted(),
        total,
        fileName: info.relPath,
        action: info.action,
        fileBytesDone: bytes?.done,
        fileBytesTotal: bytes?.total,
        statusText
      })
    })

    return (relPath) => lastByteProgress.get(relPath)
  }

  private trackInFlightTransfer(
    inFlight: Map<string, { relPath: string; action: MobileIncrementalProgress['action'] }>,
    fullPath: string,
    relPath: string,
    action: MobileIncrementalProgress['action']
  ) {
    const entry = { relPath, action }
    inFlight.set(fullPath, entry)
    inFlight.set(normalizeSyncFilePath(fullPath), entry)
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
    return createEmptySyncManifest(this.deviceId)
  }

  /** 合并磁盘与内存中的 manifest 条目，较新的来源覆盖较旧（用于跳过未变更文件的 MD5） */
  private mergeManifestFileCaches(...sources: Array<SyncManifest | null | undefined>): SyncManifest {
    const merged = this.emptyManifest()
    for (const source of sources) {
      if (!source?.files) continue
      Object.assign(merged.files, source.files)
    }
    return merged
  }

  private async fetchRemoteManifestLight(
    config: S3SyncConfig,
    syncRoot: string
  ): Promise<SyncManifest> {
    const client = new MobileIncrementalCloudClient(config, this.fileSystem)
    client.setVaultPath(syncRoot)
    const rel = `.baishou/${SYNC_MANIFEST_FILENAME}`
    const temp = `${getAppCacheDirectory()}temp-remote-scopes-${Date.now()}.json`
    try {
      await client.downloadFile(rel, temp)
      const raw = await this.fileSystem.readFile(temp)
      return normalizeSyncManifest(JSON.parse(raw) as SyncManifest)
    } catch {
      return this.emptyManifest()
    } finally {
      await this.fileSystem.unlink(temp).catch(() => {})
    }
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

  private async downloadSyncFile(
    client: MobileIncrementalCloudClient,
    relPath: string,
    fullPath: string,
    size: number
  ): Promise<boolean> {
    try {
      await client.downloadFile(relPath, fullPath, size > 0 ? size : undefined)
      return await this.fileSystem.exists(fullPath)
    } catch (error) {
      if (isIncrementalSyncRemoteFileNotFoundError(error)) {
        console.warn(`[MobileIncremental] Remote file missing, skip download: ${relPath}`)
        return false
      }
      throw error
    }
  }

  private async backupLocalFile(syncRoot: string, relPath: string): Promise<void> {
    const src = await this.resolveSyncFullPath(syncRoot, relPath)
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
    runOptions?: IncrementalSyncRunOptions,
    execution?: MobileIncrementalExecutionContext
  ): Promise<MobileIncrementalSyncOutcome> {
    const syncRoot = await this.syncRoot()
    this.invalidateExternalSyncMounts()
    const reusedLocalManifest = this.takePendingSyncLocalManifest()
    const reusedRemoteManifest = this.takePendingSyncRemoteManifest()
    const metaDir = await this.syncMetaDir()
    const client = new MobileIncrementalCloudClient(config, this.fileSystem)
    client.setVaultPath(syncRoot)
    client.setAbortSignal(execution?.signal)

    onProgress?.({ phase: 'scanning', current: 0, total: 0 })
    const localManifest =
      reusedLocalManifest ??
      (await this.buildLocalManifest((current, total, fileName) => {
        onProgress?.({ phase: 'scanning', current, total, fileName })
      }))

    onProgress?.({ phase: 'comparing', current: 0, total: 1 })
    const remoteManifest =
      reusedRemoteManifest ??
      (await this.getRemoteManifest(client, (current, total, fileName) => {
        onProgress?.({ phase: 'comparing', current, total, fileName })
      }))
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

    const sortedDecisions = sortSyncDecisionsBySizeAsc(decisions)
    const totalDecisions = sortedDecisions.length
    const sessionStartedAt = Date.now()
    await this.touchSyncSession(metaDir, 'sync', totalDecisions, 0)

    let uploaded = 0
    let downloaded = 0
    let skipped = 0
    let deletedRemote = 0
    let deletedLocal = 0
    const conflicted: string[] = []
    let workingManifest: SyncManifest = normalizeSyncManifest({
      ...localManifest,
      files: { ...localManifest.files },
      removed: { ...getSyncManifestRemovedMap(remoteManifest) }
    })

    const fileConcurrency = resolveSyncFileConcurrencyFromDecisions(
      sortedDecisions,
      config.fileConcurrency
    )
    const progressState = { completed: 0 }
    const signal = execution?.signal
    const inFlight = new Map<
      string,
      { relPath: string; action: MobileIncrementalProgress['action'] }
    >()
    const getFileBytes = this.bindTransferProgress(
      client,
      onProgress,
      () => progressState.completed,
      totalDecisions,
      inFlight
    )
    const checkpoint = this.createCheckpointRuntime(metaDir, client, config)
    const manifestCommitQueue = this.manifestCommitQueue

    await limitExecute(sortedDecisions, fileConcurrency, async (d) => {
      throwIfIncrementalSyncAborted(signal)

      const resolveAction = (): MobileIncrementalProgress['action'] => {
        if (d.type === 'upload' || (d.type === 'conflict-resolved' && d.direction === 'upload')) {
          return 'upload'
        }
        if (d.type === 'download' || (d.type === 'conflict-resolved' && d.direction === 'download')) {
          return 'download'
        }
        if (d.type === 'delete-remote' || d.type === 'delete-local') return 'delete'
        if (d.type === 'skip') return 'skip'
        return undefined
      }

      const fullPath = await this.resolveSyncFullPath(syncRoot, d.filePath)
      const action = resolveAction()
      if (action === 'upload' || action === 'download') {
        this.trackInFlightTransfer(inFlight, fullPath, d.filePath, action)
        this.emitFileTransferStart(
          onProgress,
          progressState.completed,
          totalDecisions,
          d.filePath,
          action,
          d.size
        )
      }

      let mutated = false
      try {
        switch (d.type) {
          case 'upload':
            await client.uploadFile(fullPath)
            uploaded++
            mutated = true
            break
          case 'download':
            if (await this.downloadSyncFile(client, d.filePath, fullPath, d.size)) {
              downloaded++
              mutated = true
            }
            break
          case 'delete-remote':
            await client.deleteFile(d.filePath)
            deletedRemote++
            mutated = true
            break
          case 'delete-local':
            await this.fileSystem.unlink(fullPath)
            deletedLocal++
            mutated = true
            break
          case 'conflict-resolved':
            conflicted.push(d.filePath)
            if (d.direction === 'upload') {
              await this.backupLocalFile(syncRoot, d.filePath)
              await client.uploadFile(fullPath)
              uploaded++
            } else {
              await this.backupLocalFile(syncRoot, d.filePath)
              if (await this.downloadSyncFile(client, d.filePath, fullPath, d.size)) {
                downloaded++
              }
            }
            mutated = true
            break
          case 'skip':
            skipped++
            break
        }
      } finally {
        inFlight.delete(fullPath)
        inFlight.delete(normalizeSyncFilePath(fullPath))
      }

      if (mutated) {
        const bytes = getFileBytes(d.filePath)
        onProgress?.({
          phase: 'syncing',
          current: progressState.completed,
          total: totalDecisions,
          fileName: d.filePath,
          action,
          fileBytesDone: bytes?.done,
          fileBytesTotal: bytes?.total,
          statusText: '正在保存同步进度…'
        })
        await manifestCommitQueue.run(async () => {
          workingManifest = await this.applyDecisionToManifest(workingManifest, d, syncRoot)
          await checkpoint.afterMutation(workingManifest)
        })
      }

      progressState.completed++
      await checkpoint.afterDecisionProgress({
        metaDir,
        mode: 'sync',
        total: totalDecisions,
        completed: progressState.completed,
        lastFile: d.filePath,
        startedAt: sessionStartedAt
      })
      if (d.type !== 'skip' || progressState.completed === totalDecisions || progressState.completed % 24 === 0) {
        onProgress?.(mapDecisionProgress(progressState.completed, totalDecisions, d))
      }
    })

    client.setTransferProgressCallback(undefined)
    client.setTransferActivityCallback(undefined)
    const scanned = await this.buildLocalManifest()
    const finalManifest = finalizeIncrementalSyncManifest({
      scanned,
      baselineRemote: remoteManifest,
      decisions: sortedDecisions,
      deviceId: this.deviceId
    })
    await checkpoint.finalize(finalManifest, {
      metaDir,
      mode: 'sync',
      total: totalDecisions,
      completed: progressState.completed,
      lastFile: sortedDecisions[totalDecisions - 1]?.filePath,
      startedAt: sessionStartedAt
    })
    this.lastConflicts = conflicted
    await clearIncrementalSyncSession(this.fileSystem, metaDir)
    onProgress?.({ phase: 'finalizing', current: 1, total: 1 })

    return {
      uploaded,
      downloaded,
      conflicts: conflicted.length,
      skipped,
      deletedRemote,
      deletedLocal,
      failed: 0,
      failedPaths: []
    }
  }

  async collectManifestVaultScopes(config: S3SyncConfig): Promise<Set<string>> {
    if (this.planManifestCache) {
      return collectManifestVaultScopes(this.planManifestCache.local, this.planManifestCache.remote)
    }

    const syncRoot = await this.syncRoot()
    const [scanned, remote] = await Promise.all([
      scanIncrementalSyncFilesForManifest(this.fileSystem, syncRoot),
      this.fetchRemoteManifestLight(config, syncRoot)
    ])
    const localFromScan: SyncManifest = {
      ...this.emptyManifest(),
      files: Object.fromEntries(
        scanned.map((file) => [
          file.relPath,
          { hash: '', size: file.size, lastModified: file.mtimeMs }
        ])
      )
    }
    return collectManifestVaultScopes(localFromScan, remote)
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
    const { local: localManifest, remote: remoteManifest } = await this.loadPlanManifests(
      config,
      onProgress
    )

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
    const { decisions, deleteBlock } = buildIncrementalSyncPlanMergeResult(
      localManifest,
      remoteManifest,
      ancestorSnapshot,
      previousLocalManifest,
      runOptions
    )

    const manifestVaultScopes = collectManifestVaultScopes(localManifest, remoteManifest)
    const pendingChangeCount = decisions.filter((d) => d.type !== 'skip').length

    const metaDir = await this.syncMetaDir()
    const interruptedSession = await readIncrementalSyncSession(this.fileSystem, metaDir)
    const extraWarnings: string[] = []
    let interruptedSyncResume: { completed: number; total: number } | undefined

    if (
      interruptedSession &&
      shouldClearInterruptedSyncSessionOnPlan(
        interruptedSession,
        decisions.length,
        pendingChangeCount
      )
    ) {
      await clearIncrementalSyncSession(this.fileSystem, metaDir)
    } else if (isInterruptedSyncSessionResumable(interruptedSession) && pendingChangeCount > 0) {
      extraWarnings.push('data_sync.plan_warning_interrupted_session')
      interruptedSyncResume = {
        completed: interruptedSession.completed,
        total: interruptedSession.total
      }
    }

    return {
      ...buildIncrementalSyncPlanPreview({
        decisions,
        registeredVaults: context.registeredVaults,
        diskVaultNames: context.diskVaultNames,
        activeVaultName: context.activeVaultName,
        manifestVaultScopes,
        requiresHighDivergenceConfirm,
        divergencePercent,
        maxDivergencePercent,
        deletePropagationBlocked: deleteBlock != null,
        deletePropagationReason: deleteBlock?.reason,
        blockedDeleteCount: deleteBlock?.deleteCount,
        blockedDeleteDirection: deleteBlock?.direction,
        extraWarnings
      }),
      interruptedSyncResume,
      planReuseBaseline: buildIncrementalSyncPlanReuseBaseline(localManifest, remoteManifest)
    }
  }
}
