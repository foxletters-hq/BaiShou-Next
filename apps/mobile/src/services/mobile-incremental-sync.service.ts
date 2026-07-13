import i18n from 'i18next'
import {
  buildS3ListUrl,
  buildS3ObjectUrl,
  DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
  isIncrementalSyncReady,
  migrateLegacyIncrementalSyncConfig,
  normalizeS3BasePath,
  s3FetchHeaders,
  signS3Request,
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
import { FileSystemUploadType, uploadAsync } from './mobile-http-transfer'
import {
  MobileIncrementalEngine,
  type MobileIncrementalProgress
} from './mobile-incremental-engine'
import { MobileIncrementalCloudClient } from './mobile-incremental-cloud.client'
import { hasRemoteManifestDrift } from './mobile-incremental-plan-reuse.util'
import type { MobileDataBootstrapper } from './mobile-bootstrapper.service'
import { emitSyncMutation } from '../cache/mobile-cache-coordinator'
import { reconcileUserAvatarProfileAfterStorageChange } from '../lib/user-avatar-reconcile.util'
import { MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES } from './mobile-file-read-limits'
import { classifyIncrementalSyncPaths } from './mobile-incremental-sync-path-classify.util'
import type { MobileIncrementalSyncOutcome } from './mobile-incremental-engine.types'

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

const DEFAULT_CONFIG: S3SyncConfig = {
  enabled: false,
  endpoint: '',
  region: 'us-east-1',
  bucket: '',
  path: DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
  accessKey: '',
  secretKey: '',
  target: 's3',
  fileConcurrency: 5,
  chunkConcurrency: 5,
  maxDivergencePercent: 100
}

type VaultSyncConfig = Partial<S3SyncConfig> & {
  s3AccessKey?: string
  s3SecretKey?: string
  s3Path?: string
  webdavUsername?: string
  webdavPassword?: string
  webdavPath?: string
}

function normalizeVaultConfig(partial?: VaultSyncConfig | null): S3SyncConfig {
  const base = mergeConfig(partial)
  const target = partial?.target === 'webdav' ? 'webdav' : 's3'
  if (target === 'webdav') {
    return {
      ...base,
      target: 'webdav',
      accessKey: (partial?.accessKey || partial?.webdavUsername || '').trim(),
      secretKey: (partial?.secretKey || partial?.webdavPassword || '').trim(),
      path: partial?.path || partial?.webdavPath || base.path
    }
  }
  return {
    ...base,
    target: 's3',
    accessKey: (partial?.accessKey || partial?.s3AccessKey || '').trim(),
    secretKey: (partial?.secretKey || partial?.s3SecretKey || '').trim(),
    path: partial?.path || partial?.s3Path || base.path,
    fileConcurrency: partial?.fileConcurrency ?? base.fileConcurrency,
    chunkConcurrency: partial?.chunkConcurrency ?? base.chunkConcurrency
  }
}

function mergeConfig(partial?: Partial<S3SyncConfig> | null): S3SyncConfig {
  return { ...DEFAULT_CONFIG, ...partial }
}

function isConfigReady(config: S3SyncConfig): boolean {
  return isIncrementalSyncReady(config)
}

async function testWebDav(
  config: S3SyncConfig,
  fileSystem: IFileSystem,
  syncRoot: string
): Promise<void> {
  const client = new MobileIncrementalCloudClient(config, fileSystem)
  client.setVaultPath(syncRoot)
  await client.listFiles()
}

async function testS3(config: S3SyncConfig): Promise<void> {
  const prefix = normalizeS3BasePath(config.path)
  const listUrl = buildS3ListUrl({
    endpoint: config.endpoint,
    bucket: config.bucket,
    prefix,
    maxKeys: 1
  })

  const signed = await signS3Request(
    'GET',
    listUrl,
    config.region || 'us-east-1',
    config.accessKey,
    config.secretKey,
    null
  )
  const response = await fetch(listUrl, { method: 'GET', headers: s3FetchHeaders(signed) })
  if (!response.ok) {
    throw new Error(`S3 list failed: ${response.status} ${response.statusText}`)
  }
}

async function uploadWebDav(
  config: S3SyncConfig,
  localZipPath: string,
  remoteName: string
): Promise<void> {
  const baseUrl = (config.webdavUrl || '').replace(/\/$/, '')
  let basePath = config.path?.startsWith('/') ? config.path : `/${config.path || ''}`
  if (!basePath.endsWith('/')) basePath += '/'
  const remotePath = `${basePath}${remoteName}`
  const auth = `Basic ${btoa(`${config.accessKey}:${config.secretKey}`)}`

  const response = await uploadAsync(`${baseUrl}${remotePath}`, localZipPath, {
    httpMethod: 'PUT',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/zip'
    },
    uploadType: FileSystemUploadType.BINARY_CONTENT
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`WebDAV upload failed: ${response.status}`)
  }
}

async function uploadS3(
  config: S3SyncConfig,
  localZipPath: string,
  remoteName: string
): Promise<void> {
  const objectName = `${normalizeS3BasePath(config.path)}${remoteName}`
  const url = buildS3ObjectUrl({
    endpoint: config.endpoint,
    bucket: config.bucket,
    objectKey: objectName
  })

  const contentType = 'application/zip'
  const signed = await signS3Request(
    'PUT',
    url,
    config.region || 'us-east-1',
    config.accessKey,
    config.secretKey,
    null,
    { 'Content-Type': contentType }
  )

  const response = await uploadAsync(url, localZipPath, {
    httpMethod: 'PUT',
    headers: {
      ...s3FetchHeaders(signed),
      'Content-Type': contentType
    },
    uploadType: FileSystemUploadType.BINARY_CONTENT
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`S3 upload failed: ${response.status}`)
  }
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

    this.postSyncMaintenancePromise = (async () => {
      try {
        const cls = classifyIncrementalSyncPaths([
          ...outcome.downloadedPaths,
          ...outcome.deletedLocalPaths
        ])
        console.warn('[IncrementalSync][PostSync] start', {
          uploaded: outcome.uploaded,
          downloaded: outcome.downloaded,
          deletedLocal: outcome.deletedLocal,
          classify: {
            journals: cls.journals,
            sessions: cls.sessions,
            summaries: cls.summaries,
            settings: cls.settings,
            assistants: cls.assistants,
            sessionRefCount: cls.sessionRefs.length
          }
        })
        const needsLocalIndex =
          outcome.downloaded > 0 ||
          outcome.deletedLocal > 0 ||
          cls.journals ||
          cls.sessions ||
          cls.summaries ||
          cls.settings ||
          cls.assistants

        let step = 0
        const needsSessionHydrate = cls.sessions || cls.sessionRefs.length > 0
        const totalSteps = (needsSessionHydrate ? 1 : 0) + (needsLocalIndex ? 3 : 0) + 1
        const checkpointRefreshPaths: string[] = []

        if (needsSessionHydrate && this.sessionManager) {
          this.reportPostSync('data_sync.progress_hydrate_sessions', ++step, totalSteps)
          try {
            const { listDiskVaultFolderNames } = await import('@baishou/core-mobile')
            const syncRoot = await this.pathService.getRootDirectory()
            const diskVaultNames = await listDiskVaultFolderNames(this.fileSystem, syncRoot)
            let activeVaultName: string | null = null
            const pathWithContext = this.pathService as IStoragePathService & {
              getActiveVaultNameForContext?: () => Promise<string>
            }
            if (typeof pathWithContext.getActiveVaultNameForContext === 'function') {
              activeVaultName = await pathWithContext.getActiveVaultNameForContext()
            }
            // 缺 id 补齐（廉价）
            await this.sessionManager.hydrateSessionsFromDiskIfNeeded({
              activeVaultName,
              diskVaultNames,
              maxSessionJsonReadBytes: MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES
            })
            // 本次下载的会话定点灌库（不 fullScan、不 flushPending 写盘）
            if (cls.sessionRefs.length > 0) {
              await this.sessionManager.importSessionsFromDisk(cls.sessionRefs, {
                maxSessionJsonReadBytes: MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES
              })
            }
          } catch (e: unknown) {
            console.warn('[IncrementalSync][SessionHydrate] after-sync failed:', e)
          }
        }

        if (!needsLocalIndex) {
          this.reportPostSync('data_sync.progress_finalizing', totalSteps, totalSteps)
          console.warn('[IncrementalSync][PostSync] skip-index', { reason: 'upload-or-noop' })
          return
        }

        const deps = this.bootstrapper?.getRegisteredDeps()
        if (this.bootstrapper && deps) {
          this.reportPostSync('data_sync.progress_index_local', ++step, totalSteps)
          await this.bootstrapper.runSelectiveResync(deps, {
            journals:
              cls.journals ||
              outcome.deletedLocalPaths.some((p) => /Journals|Diary/i.test(p)),
            summaries: cls.summaries,
            assistants: cls.assistants,
            settings: cls.settings,
            skipEnsures: true,
            onStep: (key) => this.reportPostSync(key, step, totalSteps)
          })
        }

        this.reportPostSync('data_sync.progress_reconcile_avatar', ++step, totalSteps)
        if (cls.settings || outcome.downloadedPaths.some((p) => /avatar/i.test(p))) {
          const avatarResult = await reconcileUserAvatarProfileAfterStorageChange(
            this.settingsManager,
            this.pathService,
            this.fileSystem
          )
          if (avatarResult.changed) {
            const profileRel = await this.resolveActiveUserProfileSyncRelPath()
            if (profileRel) checkpointRefreshPaths.push(profileRel)
            console.warn('[IncrementalSync][PostSync] avatar-profile-rewritten', {
              profileRel
            })
          }
        }

        if (cls.journals) {
          this.reportPostSync('data_sync.progress_schedule_embed', ++step, totalSteps)
          const { schedulePostSyncDiaryBatchEmbed } =
            await import('./mobile-post-sync-diary-embed.service')
          schedulePostSyncDiaryBatchEmbed()
        }

        if (checkpointRefreshPaths.length > 0) {
          try {
            await this.refreshCheckpointForPaths(checkpointRefreshPaths)
          } catch (e: unknown) {
            console.warn('[IncrementalSync][PostSync] refreshCheckpoint failed:', e)
          }
        }

        this.reportPostSync('data_sync.progress_finalizing', totalSteps, totalSteps)
        console.warn('[IncrementalSync][PostSync] done', {
          checkpointRefreshCount: checkpointRefreshPaths.length
        })
      } catch (e: unknown) {
        console.warn('[MobileIncrementalSync] afterSyncComplete failed:', e)
      } finally {
        this.onAfterSyncComplete?.()
      }
    })()
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
