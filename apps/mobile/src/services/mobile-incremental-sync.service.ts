import i18n from 'i18next'
import {
  migrateLegacyIncrementalSyncConfig,
  type S3SyncConfig,
  type IncrementalSyncRunOptions,
  type IncrementalSyncPlanPreview
} from '@baishou/shared'
import type {
  IFileSystem,
  IArchiveService,
  SettingsManagerService,
  AssistantManagerService,
  SessionManagerService
} from '@baishou/core-mobile'
import type { IStoragePathService } from '@baishou/core-mobile'
import {
  MobileIncrementalEngine,
  type MobileIncrementalProgress
} from './mobile-incremental-engine'
import { MobileIncrementalCloudClient } from './mobile-incremental-cloud.client'
import { hasRemoteManifestDrift } from './mobile-incremental-plan-reuse.util'
import type { MobileDataBootstrapper } from './mobile-bootstrapper.service'
import { emitSyncMutation } from '../cache/mobile-cache-coordinator'
import type { MobileIncrementalSyncOutcome } from './mobile-incremental-engine.types'
import {
  isConfigReady,
  mergeConfig,
  normalizeVaultConfig,
  testS3,
  testWebDav,
  uploadS3,
  uploadWebDav,
  type VaultSyncConfig
} from './mobile-incremental-sync-config.util'
import { runMobileIncrementalAfterSync } from './mobile-incremental-sync-after.util'

export type IncrementalSyncProgress = MobileIncrementalProgress

export type IncrementalSyncResult = {
  uploaded: number
  downloaded: number
  conflicts: number
  skipped: number
  failed: number
  uploadedPaths?: string[]
  downloadedPaths?: string[]
  deletedLocalPaths?: string[]
  deletedRemotePaths?: string[]
}

export class MobileIncrementalSyncService {
  private readonly engine: MobileIncrementalEngine
  private onAfterSyncComplete?: () => void
  private postSyncMaintenancePromise: Promise<void> | null = null
  private postSyncProgressListener: ((progress: IncrementalSyncProgress) => void) | null = null

  constructor(
    private readonly settingsManager: SettingsManagerService,
    private readonly archiveService: IArchiveService,
    private readonly pathService: IStoragePathService,
    private readonly fileSystem: IFileSystem,
    private readonly bootstrapper?: MobileDataBootstrapper,
    deviceId: string = `mobile-${Date.now()}`,
    onAfterSyncComplete?: () => void,
    private readonly assistantManager?: AssistantManagerService,
    private readonly sessionManager?: SessionManagerService
  ) {
    this.engine = new MobileIncrementalEngine(pathService, fileSystem, deviceId)
    this.onAfterSyncComplete = onAfterSyncComplete
  }

  setOnAfterSyncComplete(handler?: () => void): void {
    this.onAfterSyncComplete = handler
  }

  setPostSyncProgressListener(
    listener: ((progress: IncrementalSyncProgress) => void) | null
  ): void {
    this.postSyncProgressListener = listener
  }

  private reportPostSync(statusText: string, current: number, total: number): void {
    this.postSyncProgressListener?.({
      phase: 'finalizing',
      statusText,
      current,
      total
    })
  }

  /**
   * 传输结束后的本地收尾：只处理本次触及的文件类型。
   * 禁止无条件全量 resync（会写盘改 hash，导致下次又提示上传）。
   */
  private afterSyncComplete(outcome: MobileIncrementalSyncOutcome): void {
    emitSyncMutation('complete', 'incremental-sync')

    this.postSyncMaintenancePromise = runMobileIncrementalAfterSync(outcome, {
      settingsManager: this.settingsManager,
      pathService: this.pathService,
      fileSystem: this.fileSystem,
      bootstrapper: this.bootstrapper,
      sessionManager: this.sessionManager,
      reportPostSync: (statusText, current, total) =>
        this.reportPostSync(statusText, current, total),
      refreshCheckpointForPaths: (relPaths) => this.refreshCheckpointForPaths(relPaths),
      resolveActiveUserProfileSyncRelPath: () => this.resolveActiveUserProfileSyncRelPath(),
      onAfterSyncComplete: this.onAfterSyncComplete
    })
  }

  /** 收尾若写了同步树内文件，重算 hash 并更新 local/ancestor/远端 manifest */
  async refreshCheckpointForPaths(relPaths: string[]): Promise<void> {
    const config = await this.getConfig()
    if (!isConfigReady(config)) return
    await this.engine.refreshCheckpointForPaths(config, relPaths)
  }

  private async resolveActiveUserProfileSyncRelPath(): Promise<string | null> {
    try {
      const syncRoot = (await this.pathService.getRootDirectory()).replace(/\\/g, '/')
      const settingsDir = (await this.pathService.getActiveVaultSettingsDirectory()).replace(
        /\\/g,
        '/'
      )
      const full = `${settingsDir.replace(/\/$/, '')}/settings/user_profile.json`
      const root = syncRoot.replace(/\/$/, '')
      if (full === root || !full.startsWith(`${root}/`)) return null
      return full.slice(root.length + 1)
    } catch {
      return null
    }
  }

  /** 等待后台 resync / 头像等对账完成（传输已结束） */
  async awaitPostSyncMaintenance(): Promise<void> {
    const promise = this.postSyncMaintenancePromise
    if (!promise) return
    await promise
    if (this.postSyncMaintenancePromise === promise) {
      this.postSyncMaintenancePromise = null
    }
  }

  private async rootConfigPath(): Promise<string> {
    const root = await this.pathService.getRootDirectory()
    const vault = await this.pathService.getActiveVaultPath()
    return migrateLegacyIncrementalSyncConfig(root, vault, {
      exists: (p) => this.fileSystem.exists(p),
      read: (p) => this.fileSystem.readFile(p),
      write: (p, content) => this.fileSystem.writeFile(p, content),
      unlink: (p) => this.fileSystem.unlink(p)
    })
  }

  async getConfig(): Promise<S3SyncConfig> {
    const configPath = await this.rootConfigPath()
    try {
      if (await this.fileSystem.exists(configPath)) {
        const raw = await this.fileSystem.readFile(configPath)
        const fromVault = JSON.parse(raw) as VaultSyncConfig
        return normalizeVaultConfig(fromVault)
      }
    } catch {
      // fall through to defaults
    }
    return normalizeVaultConfig(null)
  }

  async saveConfig(config: Partial<S3SyncConfig>): Promise<void> {
    const merged = mergeConfig({ ...(await this.getConfig()), ...config })
    const configPath = await this.rootConfigPath()
    await this.fileSystem.writeFile(configPath, JSON.stringify(merged, null, 2))
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig()
    return isConfigReady(config)
  }

  async testConnection(configOverride?: Partial<S3SyncConfig>): Promise<void> {
    const config = normalizeVaultConfig({ ...(await this.getConfig()), ...configOverride })
    if (config.target === 'webdav') {
      const syncRoot = await this.pathService.getRootDirectory()
      await testWebDav(config, this.fileSystem, syncRoot)
    } else {
      await testS3(config)
    }
  }

  async prepareSessionsForSyncScan(
    activeVaultName?: string | null,
    diskVaultNames?: string[] | null,
    options?: { mode?: 'full' | 'pending-only' }
  ): Promise<{
    flushed: number
    pendingFlushed: boolean
    diskChanged: boolean
  }> {
    console.warn('[IncrementalSync][SessionFlush] prepare-start', {
      hasSessionManager: Boolean(this.sessionManager),
      inputActiveVaultName: activeVaultName ?? null,
      inputDiskVaultNames: diskVaultNames ?? null,
      mode: options?.mode ?? 'full'
    })
    if (!this.sessionManager) {
      console.warn('[IncrementalSync][SessionFlush] prepare-abort', {
        reason: 'sessionManager-null'
      })
      return { flushed: 0, pendingFlushed: false, diskChanged: false }
    }
    try {
      let vaultName = activeVaultName ?? null
      if (!vaultName) {
        const pathWithContext = this.pathService as IStoragePathService & {
          getActiveVaultNameForContext?: () => Promise<string>
        }
        if (typeof pathWithContext.getActiveVaultNameForContext === 'function') {
          vaultName = await pathWithContext.getActiveVaultNameForContext()
        }
      }

      let vaultNames = [...(diskVaultNames ?? [])]
      if (vaultNames.length === 0) {
        try {
          const { listDiskVaultFolderNames } = await import('@baishou/core-mobile')
          const syncRoot = await this.pathService.getRootDirectory()
          vaultNames = await listDiskVaultFolderNames(this.fileSystem, syncRoot)
        } catch (e) {
          console.warn('[IncrementalSync][SessionFlush] list-disk-vaults-failed', {
            error: e instanceof Error ? e.message : String(e)
          })
        }
      }

      console.warn('[IncrementalSync][SessionFlush] prepare-resolved-vault', {
        vaultName: vaultName ?? null,
        diskVaultNames: vaultNames
      })
      const result = await this.sessionManager.ensureSessionsFlushedToDisk({
        activeVaultName: vaultName,
        diskVaultNames: vaultNames,
        mode: options?.mode ?? 'full'
      })
      const diskChanged = result.flushed > 0 || result.pendingFlushed
      console.warn('[IncrementalSync][SessionFlush] prepare-done', {
        vaultName: result.activeVaultName,
        flushed: result.flushed,
        pendingFlushed: result.pendingFlushed,
        diskChanged,
        skippedMissingScan: result.skippedMissingScan,
        dbTotalCount: result.dbTotalCount,
        dbCount: result.dbCount,
        diskCount: result.diskCount,
        missingCount: result.missingIds.length,
        failedCount: result.failedIds.length,
        skippedOtherVaultCount: result.skippedOtherVaultCount
      })

      // 规划/确认路径不做会话水合：全量 upsert 很慢，且会改本地状态导致二次确认。
      // 缺库会话在同步结束后的 afterSyncComplete 再补。

      return {
        flushed: result.flushed,
        pendingFlushed: result.pendingFlushed,
        diskChanged
      }
    } catch (e: unknown) {
      console.warn('[IncrementalSync][SessionFlush] prepare-failed', {
        error: e instanceof Error ? e.message : String(e)
      })
      return { flushed: 0, pendingFlushed: false, diskChanged: false }
    }
  }

  async planSync(
    context: {
      registeredVaults: string[]
      diskVaultNames: string[]
      activeVaultName: string | null
    },
    onProgress?: (progress: IncrementalSyncProgress) => void,
    runOptions?: IncrementalSyncRunOptions
  ): Promise<IncrementalSyncPlanPreview> {
    const config = await this.getConfig()
    if (!isConfigReady(config)) {
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.services.mobile.incremental.sync.service.L331',
          '增量同步未配置或已禁用'
        )
      )
    }
    console.warn('[IncrementalSync][SessionFlush] planSync-before-prepare', {
      activeVaultName: context.activeVaultName,
      diskVaultNames: context.diskVaultNames,
      mode: 'pending-only'
    })
    // 规划只读：仅 flush dirty，不补写缺失会话 JSON，减少计划期磁盘漂移
    await this.prepareSessionsForSyncScan(context.activeVaultName, context.diskVaultNames, {
      mode: 'pending-only'
    })
    return this.engine.planSync(config, context, runOptions, (progress) => onProgress?.(progress))
  }

  async collectManifestVaultScopes(): Promise<Set<string>> {
    const config = await this.getConfig()
    if (!isConfigReady(config)) {
      return new Set()
    }
    return this.engine.collectManifestVaultScopes(config)
  }

  beginPlanSession(): void {
    this.engine.beginPlanSession()
  }

  endPlanSession(): void {
    this.engine.endPlanSession()
  }

  discardPendingLocalManifest(): void {
    this.engine.discardPendingLocalManifest()
  }

  finalizePlanSession(): void {
    this.engine.finalizePlanSession()
  }

  peekPendingSyncPlanLocalManifest() {
    return this.engine.peekPendingSyncLocalManifest()
  }

  peekPendingSyncPlanRemoteManifest() {
    return this.engine.peekPendingSyncRemoteManifest()
  }

  /** 确认同步前检测远端 manifest 是否在弹窗期间发生变化 */
  async detectRemoteManifestDrift(): Promise<boolean> {
    const baseline = this.engine.peekPendingSyncRemoteManifest()
    if (!baseline) return false

    const config = await this.getConfig()
    if (!isConfigReady(config)) return false

    const syncRoot = await this.pathService.getRootDirectory()
    const client = new MobileIncrementalCloudClient(config, this.fileSystem)
    client.setVaultPath(syncRoot)
    const fresh = await this.engine.getRemoteManifest(client)
    return hasRemoteManifestDrift(baseline, fresh)
  }

  /**
   * 三向合并增量同步（对齐桌面 ThreeWaySyncService.sync）
   */
  async sync(
    onProgress?: (progress: IncrementalSyncProgress) => void,
    runOptions?: IncrementalSyncRunOptions,
    abortSignal?: AbortSignal
  ): Promise<IncrementalSyncResult> {
    const config = await this.getConfig()
    if (!isConfigReady(config)) {
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.services.mobile.incremental.sync.service.L389',
          '增量同步未配置或已禁用'
        )
      )
    }

    try {
      const prep = await this.prepareSessionsForSyncScan()
      console.warn('[IncrementalSync][SessionFlush] sync-after-prepare', {
        flushed: prep.flushed,
        pendingFlushed: prep.pendingFlushed,
        diskChanged: prep.diskChanged
      })
      // 仅当磁盘相对规划时发生变化时作废本地 pending；保留远端 pending，减少确认/执行不一致
      if (prep.diskChanged) {
        this.engine.discardPendingLocalManifest()
        console.warn('[IncrementalSync][SessionFlush] discarded-pending-local-manifest')
      }
    } catch (e: unknown) {
      console.warn('[IncrementalSync][SessionFlush] sync-prepare-failed', {
        error: e instanceof Error ? e.message : String(e)
      })
    }

    const result = await this.engine.syncThreeWay(
      config,
      (progress) => {
        onProgress?.(progress)
      },
      runOptions,
      { signal: abortSignal }
    )

    this.afterSyncComplete(result)

    return {
      uploaded: result.uploaded,
      downloaded: result.downloaded,
      conflicts: result.conflicts,
      skipped: result.skipped,
      failed: result.failed,
      uploadedPaths: result.uploadedPaths,
      downloadedPaths: result.downloadedPaths,
      deletedLocalPaths: result.deletedLocalPaths,
      deletedRemotePaths: result.deletedRemotePaths
    }
  }

  getLastSyncConflicts(): string[] {
    return this.engine.getLastConflicts()
  }

  /**
   * 上传 vault 全量 ZIP 备份（快速备份，非逐文件 manifest 同步）
   */
  async syncUpload(
    onProgress?: (progress: IncrementalSyncProgress) => void
  ): Promise<IncrementalSyncResult> {
    const config = await this.getConfig()
    if (!isConfigReady(config)) {
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.services.mobile.incremental.sync.service.L430',
          '增量同步未配置或已禁用'
        )
      )
    }

    onProgress?.({
      current: 0,
      total: 3,
      statusText: i18n.t(
        'auto.apps.mobile.src.services.mobile.incremental.sync.service.L433',
        '打包数据文件...'
      )
    })
    const zipPath = await this.archiveService.exportToTempFile()
    if (!zipPath) {
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.services.mobile.incremental.sync.service.L436',
          '生成 vault 归档失败'
        )
      )
    }

    const remoteName = `BaiShou_IncrementalSync_${Date.now()}.zip`
    onProgress?.({
      current: 1,
      total: 3,
      statusText: i18n.t(
        'auto.apps.mobile.src.services.mobile.incremental.sync.service.L440',
        '连接远端...'
      )
    })

    try {
      if (config.target === 'webdav') {
        const syncRoot = await this.pathService.getRootDirectory()
        await testWebDav(config, this.fileSystem, syncRoot)
        onProgress?.({ current: 2, total: 3, statusText: `上传 ${remoteName}...` })
        await uploadWebDav(config, zipPath, remoteName)
      } else {
        await testS3(config)
        onProgress?.({ current: 2, total: 3, statusText: `上传 ${remoteName}...` })
        await uploadS3(config, zipPath, remoteName)
      }
    } finally {
      try {
        await this.fileSystem.unlink(zipPath)
      } catch {
        // ignore cleanup errors
      }
    }

    onProgress?.({
      current: 3,
      total: 3,
      statusText: i18n.t(
        'auto.apps.mobile.src.services.mobile.incremental.sync.service.L460',
        '完成'
      )
    })

    return { uploaded: 1, downloaded: 0, conflicts: 0, skipped: 0, failed: 0 }
  }
}
