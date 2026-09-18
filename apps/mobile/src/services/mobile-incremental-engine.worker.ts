import type { IFileSystem, RawDataSourceManager } from '@baishou/core-mobile'
import type {
  SyncManifest,
  S3SyncConfig,
  MergeDecision,
  IncrementalSyncRunOptions,
  IncrementalSyncStorageHistory
} from '@baishou/shared'
import {
  SYNC_MANIFEST_FILENAME,
  SYNC_REMOTE_SNAPSHOT_FILENAME,
  SYNC_REMOTE_VAULTS_FILENAME,
  SYNC_STORAGE_ID_FILENAME,
  type LastRemoteVaultsSnapshot
} from '@baishou/shared'
import type { IStoragePathService } from '@baishou/core-mobile'
import { MobileIncrementalCloudClient } from './mobile-incremental-cloud.client'
import {
  writeIncrementalSyncSession,
  type IncrementalSyncSessionMode
} from './mobile-incremental-sync-session.util'
import { IncrementalManifestCommitQueue } from './mobile-incremental-manifest-commit.util'
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
import { joinIncrementalPath } from './mobile-incremental-engine-path.util'
import {
  emptyIncrementalManifest,
  fetchRemoteManifestLight,
  getIncrementalRemoteManifest,
  getIncrementalSyncStorageHistoryState,
  loadIncrementalRemoteSnapshot,
  loadLastRemoteVaultsSnapshot,
  loadLocalVaultIdToNameMap,
  mergeIncrementalManifestFileCaches,
  readIncrementalLocalManifestFile,
  refreshIncrementalCheckpointForPaths,
  saveIncrementalLocalManifest,
  saveIncrementalRemoteSnapshot,
  saveLastRemoteVaultsSnapshot
} from './mobile-incremental-engine-io.helpers'
import {
  backupIncrementalLocalFile,
  downloadIncrementalSyncFile,
  loadExternalSyncMounts,
  resolveIncrementalSyncFullPath
} from './mobile-incremental-engine-file.ops'

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
  /** 规划扫描全量指纹（含 hash 失败文件），用于确认前本地漂移判定 */
  lastPlanLocalScanFingerprint: string | null
  setLastPlanLocalScanFingerprint(v: string | null): void
  manifestCommitQueue: IncrementalManifestCommitQueue
  externalSyncMounts: VaultExternalSyncMount[] | null
  setExternalSyncMounts(v: VaultExternalSyncMount[] | null): void
  lastConflicts: string[]
  setLastConflicts(v: string[]): void
  invalidateExternalSyncMounts(): void
  /** Prefer Manager when rewriting a monthly JSONL shard after sync. */
  getRawDataSourceManager?: () => RawDataSourceManager | null
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
    return joinIncrementalPath(metaDir, SYNC_MANIFEST_FILENAME)
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
    return joinIncrementalPath(metaDir, SYNC_REMOTE_SNAPSHOT_FILENAME)
  }

  lastRemoteVaultsPath(metaDir: string): string {
    return joinIncrementalPath(metaDir, SYNC_REMOTE_VAULTS_FILENAME)
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
    await saveIncrementalLocalManifest(this.host, metaDir, this.manifestPath(metaDir), manifest)
  }

  storageIdPath(metaDir: string): string {
    return joinIncrementalPath(metaDir, SYNC_STORAGE_ID_FILENAME)
  }

  emptyManifest(): SyncManifest {
    return emptyIncrementalManifest(this.host.deviceId)
  }

  /** 合并磁盘与内存中的 manifest 条目，较新的来源覆盖较旧（用于跳过未变更文件的 MD5） */
  mergeManifestFileCaches(...sources: Array<SyncManifest | null | undefined>): SyncManifest {
    return mergeIncrementalManifestFileCaches(this.host.deviceId, ...sources)
  }

  async fetchRemoteManifestLight(config: S3SyncConfig, syncRoot: string): Promise<SyncManifest> {
    return fetchRemoteManifestLight(this.host, config, syncRoot)
  }

  async readLocalManifestFile(): Promise<SyncManifest> {
    const metaDir = await this.syncMetaDir()
    return readIncrementalLocalManifestFile(this.host, this.manifestPath(metaDir))
  }

  async getSyncStorageHistoryState(config: S3SyncConfig): Promise<IncrementalSyncStorageHistory> {
    const metaDir = await this.syncMetaDir()
    return getIncrementalSyncStorageHistoryState(this.host, config, this.storageIdPath(metaDir))
  }

  async loadRemoteSnapshot(config: S3SyncConfig): Promise<SyncManifest> {
    const metaDir = await this.syncMetaDir()
    return loadIncrementalRemoteSnapshot(
      this.host,
      config,
      this.snapshotPath(metaDir),
      this.storageIdPath(metaDir)
    )
  }

  async saveRemoteSnapshot(manifest: SyncManifest, config: S3SyncConfig): Promise<void> {
    const metaDir = await this.syncMetaDir()
    await saveIncrementalRemoteSnapshot(
      this.host,
      manifest,
      config,
      metaDir,
      this.snapshotPath(metaDir),
      this.storageIdPath(metaDir)
    )
  }

  async loadLocalVaultIdToNameMap(): Promise<Record<string, string>> {
    return loadLocalVaultIdToNameMap(this.host, await this.syncRoot())
  }

  async loadLastRemoteVaultsSnapshot(config: S3SyncConfig): Promise<LastRemoteVaultsSnapshot> {
    const metaDir = await this.syncMetaDir()
    return loadLastRemoteVaultsSnapshot(
      this.host,
      config,
      this.lastRemoteVaultsPath(metaDir),
      this.storageIdPath(metaDir)
    )
  }

  async saveLastRemoteVaultsSnapshot(
    config: S3SyncConfig,
    vaults?: Record<string, string>
  ): Promise<void> {
    const metaDir = await this.syncMetaDir()
    await saveLastRemoteVaultsSnapshot(
      this.host,
      config,
      metaDir,
      this.lastRemoteVaultsPath(metaDir),
      this.storageIdPath(metaDir),
      vaults,
      () => this.loadLocalVaultIdToNameMap()
    )
  }

  /**
   * 收尾写盘后二次定稿：重算指定相对路径的 hash，更新 local + ancestor，并上传远端 manifest。
   */
  async refreshCheckpointForPaths(config: S3SyncConfig, relPaths: string[]): Promise<void> {
    const syncRoot = await this.syncRoot()
    const metaDir = await this.syncMetaDir()
    const client = new MobileIncrementalCloudClient(config, this.host.fileSystem)
    client.setVaultPath(syncRoot)
    await refreshIncrementalCheckpointForPaths({
      host: this.host,
      config,
      relPaths,
      syncRoot,
      resolveSyncFullPath: (root, rel) => this.resolveSyncFullPath(root, rel),
      readLocalManifest: () => this.readLocalManifestFile(),
      loadRemoteSnapshot: () => this.loadRemoteSnapshot(config),
      saveLocalManifest: (manifest) => this.saveLocalManifest(manifest),
      saveRemoteSnapshot: (manifest) => this.saveRemoteSnapshot(manifest, config),
      flushRemoteManifest: () => this.flushRemoteManifestCheckpoint(metaDir, client)
    })
  }

  async getRemoteManifest(
    client: MobileIncrementalCloudClient,
    onProgress?: (current: number, total: number, fileName: string) => void
  ): Promise<SyncManifest> {
    return getIncrementalRemoteManifest(this.host, client, onProgress)
  }

  async downloadSyncFile(
    client: MobileIncrementalCloudClient,
    relPath: string,
    fullPath: string,
    size: number
  ): Promise<boolean> {
    return downloadIncrementalSyncFile(this.host.fileSystem, client, relPath, fullPath, size)
  }

  async backupLocalFile(syncRoot: string, relPath: string): Promise<void> {
    const src = await this.resolveSyncFullPath(syncRoot, relPath)
    await backupIncrementalLocalFile(this.host.fileSystem, src, syncRoot, relPath)
  }

  async resolveSyncFullPath(syncRoot: string, relPath: string): Promise<string> {
    const mounts = await this.getExternalSyncMounts(syncRoot)
    return resolveIncrementalSyncFullPath(this.host.fileSystem, syncRoot, relPath, mounts)
  }

  private async getExternalSyncMounts(syncRoot: string): Promise<VaultExternalSyncMount[]> {
    return loadExternalSyncMounts(
      this.host.fileSystem,
      syncRoot,
      this.host.externalSyncMounts,
      (v) => this.host.setExternalSyncMounts(v)
    )
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
