import type { IFileSystem, RawDataSourceManager } from '@baishou/core-mobile'
import type { SyncManifest, S3SyncConfig, IncrementalSyncRunOptions } from '@baishou/shared'
import {
  assertBidirectionalSyncDivergenceAllowed,
  buildIncrementalSyncPlanPreview,
  buildIncrementalSyncPlanMergeResult,
  buildIncrementalSyncPlanReuseBaseline,
  collectManifestVaultScopes,
  countUnverifiedAncestorEntries,
  isSyncDivergenceConfirmationRequiredError,
  reconcileAncestorWithRemoteTruth,
  type IncrementalSyncPlanPreview
} from '@baishou/shared'
import type { IStoragePathService } from '@baishou/core-mobile'
import { scanIncrementalSyncFilesForManifest } from './mobile-incremental-sync-scan.util'
import type { VaultExternalSyncMount } from '@baishou/shared'
import {
  clearIncrementalSyncSession,
  isInterruptedSyncSessionResumable,
  readIncrementalSyncSession,
  shouldClearInterruptedSyncSessionOnPlan
} from './mobile-incremental-sync-session.util'
import { IncrementalManifestCommitQueue } from './mobile-incremental-manifest-commit.util'
import { MobileIncrementalCloudClient } from './mobile-incremental-cloud.client'
import type {
  MobileIncrementalProgress,
  MobileIncrementalSyncOutcome,
  MobileIncrementalExecutionContext
} from './mobile-incremental-engine.types'
export type {
  MobileIncrementalProgress,
  MobileIncrementalSyncOutcome,
  MobileIncrementalExecutionContext
} from './mobile-incremental-engine.types'
import {
  MobileIncrementalEngineWorker,
  type IncrementalEngineHost
} from './mobile-incremental-engine.worker'

type IncrementalProgressCallback = (progress: MobileIncrementalProgress) => void

export class MobileIncrementalEngine implements IncrementalEngineHost {
  lastConflicts: string[] = []
  manifestUploadQueue: Promise<void> = Promise.resolve()
  planManifestCache: { local: SyncManifest; remote: SyncManifest } | null = null
  pendingSyncLocalManifest: SyncManifest | null = null
  pendingSyncRemoteManifest: SyncManifest | null = null
  lastPlanLocalScanFingerprint: string | null = null
  manifestCommitQueue = new IncrementalManifestCommitQueue()
  externalSyncMounts: VaultExternalSyncMount[] | null = null
  getRawDataSourceManager?: () => RawDataSourceManager | null
  private worker?: MobileIncrementalEngineWorker

  constructor(
    public readonly pathService: IStoragePathService,
    public readonly fileSystem: IFileSystem,
    public readonly deviceId: string,
    getRawDataSourceManager?: () => RawDataSourceManager | null
  ) {
    this.getRawDataSourceManager = getRawDataSourceManager
  }

  private initWorker(): MobileIncrementalEngineWorker {
    if (!this.worker) {
      this.worker = new MobileIncrementalEngineWorker(this)
    }
    return this.worker
  }

  setManifestUploadQueue(task: Promise<void>): void {
    this.manifestUploadQueue = task
  }

  setPlanManifestCache(v: { local: SyncManifest; remote: SyncManifest } | null): void {
    this.planManifestCache = v
  }

  setLastPlanLocalScanFingerprint(v: string | null): void {
    this.lastPlanLocalScanFingerprint = v
  }

  setExternalSyncMounts(v: VaultExternalSyncMount[] | null): void {
    this.externalSyncMounts = v
  }

  setLastConflicts(v: string[]): void {
    this.lastConflicts = v
  }

  getLastConflicts(): string[] {
    return [...this.lastConflicts]
  }

  invalidateExternalSyncMounts(): void {
    this.externalSyncMounts = null
  }

  beginPlanSession(): void {
    this.planManifestCache = null
    this.pendingSyncLocalManifest = null
    this.pendingSyncRemoteManifest = null
    this.lastPlanLocalScanFingerprint = null
  }

  endPlanSession(): void {
    this.planManifestCache = null
    this.pendingSyncLocalManifest = null
    this.pendingSyncRemoteManifest = null
  }

  /** 磁盘 flush 后仅作废本地 pending，保留远端 pending 供确认后执行复用 */
  discardPendingLocalManifest(): void {
    this.pendingSyncLocalManifest = null
    if (this.planManifestCache) {
      this.planManifestCache = null
    }
  }

  finalizePlanSession(): void {
    if (this.planManifestCache?.local) {
      this.pendingSyncLocalManifest = this.planManifestCache.local
      this.pendingSyncRemoteManifest = this.planManifestCache.remote
      // 规划阶段不落盘 local manifest：过早写盘会让确认前 replan 读到「新 previousLocal」，
      // 可能翻转 deletePropagationBlocked，误触发「同步计划已更新」二次确认。
    }
    this.planManifestCache = null
  }

  takePendingSyncLocalManifest(): SyncManifest | null {
    const manifest = this.pendingSyncLocalManifest
    this.pendingSyncLocalManifest = null
    return manifest
  }

  takePendingSyncRemoteManifest(): SyncManifest | null {
    const manifest = this.pendingSyncRemoteManifest
    this.pendingSyncRemoteManifest = null
    return manifest
  }

  peekPendingSyncLocalManifest(): SyncManifest | null {
    return this.pendingSyncLocalManifest
  }

  peekPendingSyncRemoteManifest(): SyncManifest | null {
    return this.pendingSyncRemoteManifest
  }

  async syncThreeWay(
    config: S3SyncConfig,
    onProgress?: IncrementalProgressCallback,
    runOptions?: IncrementalSyncRunOptions,
    execution?: MobileIncrementalExecutionContext
  ): Promise<MobileIncrementalSyncOutcome> {
    return this.initWorker().syncThreeWay(config, onProgress, runOptions, execution)
  }

  async buildLocalManifest(
    onProgress?: (current: number, total: number, fileName: string) => void
  ): Promise<SyncManifest> {
    return this.initWorker().buildLocalManifest(onProgress)
  }

  async saveLocalManifest(manifest: SyncManifest): Promise<void> {
    return this.initWorker().saveLocalManifest(manifest)
  }

  async loadRemoteSnapshot(config: S3SyncConfig): Promise<SyncManifest> {
    return this.initWorker().loadRemoteSnapshot(config)
  }

  async saveRemoteSnapshot(manifest: SyncManifest, config: S3SyncConfig): Promise<void> {
    return this.initWorker().saveRemoteSnapshot(manifest, config)
  }

  async refreshCheckpointForPaths(config: S3SyncConfig, relPaths: string[]): Promise<void> {
    return this.initWorker().refreshCheckpointForPaths(config, relPaths)
  }

  async getRemoteManifest(
    client: MobileIncrementalCloudClient,
    onProgress?: (current: number, total: number, fileName: string) => void
  ): Promise<SyncManifest> {
    return this.initWorker().getRemoteManifest(client, onProgress)
  }

  private async loadPlanManifests(
    config: S3SyncConfig,
    onProgress?: IncrementalProgressCallback
  ): Promise<{ local: SyncManifest; remote: SyncManifest }> {
    return this.initWorker().loadPlanManifests(config, onProgress)
  }

  async collectManifestVaultScopes(config: S3SyncConfig): Promise<Set<string>> {
    if (this.planManifestCache) {
      return collectManifestVaultScopes(this.planManifestCache.local, this.planManifestCache.remote)
    }

    const worker = this.initWorker()
    const syncRoot = await worker.syncRoot()
    const [scanned, remote] = await Promise.all([
      scanIncrementalSyncFilesForManifest(this.fileSystem, syncRoot),
      worker.fetchRemoteManifestLight(config, syncRoot)
    ])
    const localFromScan: SyncManifest = {
      ...(await worker.emptyManifest()),
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

    const storageHistory = await this.initWorker().getSyncStorageHistoryState(config)

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

    const worker = this.initWorker()
    let ancestorSnapshot = await worker.loadRemoteSnapshot(config)
    const unverifiedAncestor = countUnverifiedAncestorEntries(ancestorSnapshot, remoteManifest)
    if (unverifiedAncestor > 0) {
      console.warn(
        `[IncrementalSync] stripping ${unverifiedAncestor} unverified ancestor entr(y/ies) not present on remote`
      )
      ancestorSnapshot = reconcileAncestorWithRemoteTruth(ancestorSnapshot, remoteManifest)
    }
    const previousLocalManifest = await worker
      .readLocalManifestFile()
      .catch(() => worker.emptyManifest())
    const { decisions, deleteBlock } = buildIncrementalSyncPlanMergeResult(
      localManifest,
      remoteManifest,
      ancestorSnapshot,
      previousLocalManifest,
      runOptions
    )

    const manifestVaultScopes = collectManifestVaultScopes(localManifest, remoteManifest)
    const pendingChangeCount = decisions.filter((d) => d.type !== 'skip').length

    const metaDir = await worker.syncMetaDir()
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
      planReuseBaseline: {
        ...buildIncrementalSyncPlanReuseBaseline(localManifest, remoteManifest),
        // 用全量扫描指纹，避免 hash 失败文件导致确认时误判本地漂移
        ...(this.lastPlanLocalScanFingerprint
          ? { localFilesFingerprint: this.lastPlanLocalScanFingerprint }
          : {})
      }
    }
  }
}
