import i18n from 'i18next'
import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import {
  ThreeWaySyncService,
  SyncOrchestrator,
  OperationLogService,
  listDiskVaultFolderNames,
  createNodeFileSystem,
  S3NotConfiguredError,
  type IIncrementalSyncService
} from '@baishou/core-desktop'
import {
  DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
  resolveSyncDeviceId,
  migrateLegacyIncrementalSyncConfig,
  collectManifestVaultScopes,
  evaluateIncrementalSyncPlanDrift,
  readVaultRegistryFingerprint,
  collectSyncedAgentAvatarBasenames,
  classifyIncrementalSyncPaths,
  type IncrementalSyncPlanReuseBaseline,
  type IncrementalSyncRunOptions,
  type SyncProgressEvent,
  type S3SyncConfig,
  logger
} from '@baishou/shared'
import { IncrementalS3Client } from '../services/incremental-s3.client'
import { IncrementalWebDavClient } from '../services/incremental-webdav.client'
import { pathService, vaultService, notifyVaultRegistryUpdated } from './vault.ipc'
import { getGitService } from './git-sync.ipc'

let syncService: IIncrementalSyncService | null = null
let orchestrator: SyncOrchestrator | null = null

function getDefaultSyncConfig(): S3SyncConfig {
  return {
    enabled: false,
    endpoint: '',
    region: '',
    bucket: '',
    path: DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
    accessKey: '',
    secretKey: '',
    fileConcurrency: 5,
    chunkConcurrency: 5,
    maxDivergencePercent: 100
  }
}

async function resolveSyncConfigFile(): Promise<string | null> {
  const root = await pathService.getRootDirectory()
  const vaultPath = await pathService.getActiveVaultPath()
  const configPath = await migrateLegacyIncrementalSyncConfig(root, vaultPath, {
    exists: (p) => fs.existsSync(p),
    read: (p) => fs.promises.readFile(p, 'utf8'),
    write: (p, content) => fs.promises.writeFile(p, content, 'utf8'),
    unlink: (p) => fs.promises.unlink(p)
  })
  return fs.existsSync(configPath) ? configPath : null
}

async function ensureSyncServicesInitialized(): Promise<void> {
  if (syncService) return

  const configPath = await resolveSyncConfigFile()
  if (!configPath) return

  try {
    const raw = await fs.promises.readFile(configPath, 'utf8')
    const saved = JSON.parse(raw) as Partial<S3SyncConfig>
    const service = await createSyncService(saved as S3SyncConfig)
    await service.getConfig()
  } catch {
    // 配置损坏时保持未初始化，由 updateConfig 或 UI 重新保存
  }
}

async function getSyncService(): Promise<IIncrementalSyncService> {
  await ensureSyncServicesInitialized()
  if (!syncService) {
    throw new Error('Incremental sync service not initialized. Please update config first.')
  }
  return syncService
}

async function getOrchestrator(): Promise<SyncOrchestrator> {
  await ensureSyncServicesInitialized()
  if (!orchestrator) {
    throw new Error('Sync orchestrator not initialized. Please update config first.')
  }
  return orchestrator
}

async function resolveDesktopDeviceId(syncMetaDir: string): Promise<string> {
  return resolveSyncDeviceId('desktop', syncMetaDir, {
    exists: (p) => fs.existsSync(p),
    read: (p) => fs.promises.readFile(p, 'utf8'),
    write: (p, content) => fs.promises.writeFile(p, content, 'utf8'),
    mkdir: async (p) => {
      await fs.promises.mkdir(p, { recursive: true })
    }
  })
}

async function createSyncService(config: S3SyncConfig): Promise<IIncrementalSyncService> {
  const syncRoot = await pathService.getRootDirectory()
  const syncMetaDir = path.join(syncRoot, '.baishou')
  const deviceId = await resolveDesktopDeviceId(syncMetaDir)

  let client: IncrementalS3Client | IncrementalWebDavClient

  if (config.target === 'webdav') {
    client = new IncrementalWebDavClient(
      config.webdavUrl || '',
      config.accessKey || '',
      config.secretKey || '',
      config.path || '',
      config.chunkConcurrency
    )
  } else {
    client = new IncrementalS3Client(
      config.endpoint || '',
      config.region || '',
      config.bucket || '',
      config.accessKey || '',
      config.secretKey || '',
      config.path || '',
      config.chunkConcurrency
    )
  }

  client.setVaultPath(syncRoot)

  const { getVersionManager, getRawDataSourceManager } =
    await import('../services/raw-data-source.runtime')
  syncService = new ThreeWaySyncService(pathService, client, deviceId, getVersionManager(), () =>
    getRawDataSourceManager()
  )

  const logDir = path.join(syncMetaDir, 'sync-log')
  const logService = new OperationLogService(logDir)

  const gitService = getGitService()

  orchestrator = new SyncOrchestrator(syncService, logService, gitService, deviceId)

  return syncService
}

function incrementalSyncNeedsBootstrap(result: {
  downloaded: string[]
  deletedLocal: string[]
  uploaded?: string[]
  deletedRemote?: string[]
  conflicted?: string[]
}): boolean {
  // 仅下载/删本地才需要灌索引；纯 upload 不碰本地索引树
  return result.downloaded.length > 0 || result.deletedLocal.length > 0
}

/** 同步完成后将磁盘 JSON/设置 水合进 SQLite，并通知渲染进程刷新（对齐移动端 afterSyncComplete） */
async function afterIncrementalSync(
  result: {
    downloaded: string[]
    deletedLocal: string[]
    uploaded?: string[]
    deletedRemote?: string[]
    conflicted?: string[]
  },
  options?: { force?: boolean }
): Promise<void> {
  // delete-local / delete-remote 后若全局 AgentAvatars 残留，bootstrap mirror
  // 会再灌回当前 vault → 下次又变成上传或删云端
  const purgedAvatars = collectSyncedAgentAvatarBasenames([
    ...result.deletedLocal,
    ...(result.deletedRemote ?? [])
  ])
  if (purgedAvatars.length > 0) {
    await pathService.purgeAgentAvatarBasenames(purgedAvatars)
  }

  const cls = classifyIncrementalSyncPaths([...result.downloaded, ...result.deletedLocal])
  logger.warn('[IncrementalSync][PostSync] start', {
    downloaded: result.downloaded.length,
    deletedLocal: result.deletedLocal.length,
    uploaded: result.uploaded?.length ?? 0,
    classify: {
      journals: cls.journals,
      sessions: cls.sessions,
      summaries: cls.summaries,
      settings: cls.settings,
      assistants: cls.assistants,
      memory: cls.memory,
      graph: cls.graph,
      sessionRefCount: cls.sessionRefs.length
    }
  })

  try {
    const { getAgentManagers } = await import('./agent-helpers')
    const { sessionManager } = getAgentManagers()
    const syncRoot = await pathService.getRootDirectory()
    const diskVaultNames = await listDiskVaultFolderNames(createNodeFileSystem(), syncRoot)
    const activeVaultName = vaultService.getActiveVault()?.name ?? null

    if (cls.sessions || cls.sessionRefs.length > 0) {
      const hydrate = await sessionManager.hydrateSessionsFromDiskIfNeeded({
        activeVaultName,
        diskVaultNames
      })
      if (
        cls.sessionRefs.length > 0 &&
        typeof sessionManager.importSessionsFromDisk === 'function'
      ) {
        await sessionManager.importSessionsFromDisk(cls.sessionRefs)
      }
      if (hydrate.hydrated || cls.sessionRefs.length > 0) {
        const { BrowserWindow } = await import('electron')
        BrowserWindow.getAllWindows().forEach((w) => {
          w.webContents.send('session:file-changed')
        })
      }
    }
  } catch (e) {
    logger.warn('[IncrementalSync] session hydrate after sync failed:', e as Error)
  }

  if (!options?.force && !incrementalSyncNeedsBootstrap(result)) {
    logger.warn('[IncrementalSync][PostSync] skip-index', { reason: 'upload-or-noop' })
    return
  }

  if (!incrementalSyncNeedsBootstrap(result)) {
    logger.warn('[IncrementalSync][PostSync] skip-index', { reason: 'upload-or-noop-forced' })
    return
  }

  const needsLayerIndex =
    cls.journals ||
    cls.summaries ||
    cls.settings ||
    cls.assistants ||
    (cls.sessions && result.deletedLocal.some((p) => /\/Sessions\//i.test(p)))

  if (needsLayerIndex) {
    const { globalBootstrapper } = await import('../services/bootstrapper.service')
    await globalBootstrapper.selectiveResyncAfterIncrementalSync({
      journals: cls.journals || result.deletedLocal.some((p) => /Journals|Diary/i.test(p)),
      summaries: cls.summaries,
      assistants: cls.assistants,
      settings: cls.settings,
      sessions: cls.sessions && result.deletedLocal.some((p) => /\/Sessions\//i.test(p)),
      skipEnsures: true
    })
  } else if (cls.memory || cls.graph) {
    // Memory/Graph-only downloads skip selective resync but still need derived-index hydration
    const { runDerivedIndexHydration } = await import('../services/raw-data-source.runtime')
    await runDerivedIndexHydration('incremental-sync-memory-graph')
  } else {
    logger.warn('[IncrementalSync][PostSync] done-lite', { reason: 'sessions-hydrated-only' })
    return
  }

  if (cls.journals) {
    const { schedulePostSyncDiaryBatchEmbed } =
      await import('../services/controlled-diary-batch-embed.service')
    schedulePostSyncDiaryBatchEmbed()
  }

  logger.warn('[IncrementalSync][PostSync] done')
}

/** 远端 tombstone / removed 中的伙伴头像：清掉本地复活副本后再扫描，避免反复「删本地」 */
async function reconcileAgentAvatarsBeforeScan(
  remoteRemovedPaths: Iterable<string>
): Promise<void> {
  const basenames = collectSyncedAgentAvatarBasenames(remoteRemovedPaths)
  if (basenames.length > 0) {
    await pathService.purgeAgentAvatarBasenames(basenames)
  }
  await pathService.mirrorGlobalAgentAvatarsIntoVaults({ excludeBasenames: basenames })
}

async function resolveSyncPlanContext() {
  const syncRoot = await pathService.getRootDirectory()
  const registeredVaults = vaultService.getAllVaults().map((vault) => vault.name)
  const diskVaultNames = await listDiskVaultFolderNames(createNodeFileSystem(), syncRoot)
  const activeVault = vaultService.getActiveVault()
  return {
    registeredVaults,
    diskVaultNames,
    activeVaultName: activeVault?.name ?? null
  }
}

/** 仅在用户确认执行同步后调用：补登记磁盘/远端工作区 */
async function ensureVaultsForIncrementalSync(
  runOptions?: IncrementalSyncRunOptions
): Promise<string[]> {
  const autoRegistered = [...(await vaultService.syncRegistryWithDisk())]
  const unknown = (runOptions?.unknownVaultPaths ?? []).filter(
    (name) => name !== '__root__' && name !== '__unknown__'
  )
  if (unknown.length > 0) {
    autoRegistered.push(...(await vaultService.ensureVaultsRegistered(unknown)))
  }
  const unique = [...new Set(autoRegistered)]
  if (unique.length > 0) {
    notifyVaultRegistryUpdated()
  }
  return unique
}

async function flushPendingAgentSessionsBeforeSync(
  mode: 'full' | 'pending-only' = 'full'
): Promise<void> {
  try {
    const { getAgentManagers } = await import('./agent-helpers')
    const { sessionManager } = getAgentManagers()
    const activeVaultName = vaultService.getActiveVault()?.name ?? null
    const syncRoot = await pathService.getRootDirectory()
    const diskVaultNames = await listDiskVaultFolderNames(createNodeFileSystem(), syncRoot)
    logger.warn('[IncrementalSync][SessionFlush] desktop-prepare-start', {
      activeVaultName,
      diskVaultNames,
      mode
    })
    const result = await sessionManager.ensureSessionsFlushedToDisk({
      activeVaultName,
      diskVaultNames,
      mode
    })
    logger.warn('[IncrementalSync][SessionFlush] desktop-prepare-done', {
      activeVaultName: result.activeVaultName,
      flushed: result.flushed,
      pendingFlushed: result.pendingFlushed,
      skippedMissingScan: result.skippedMissingScan,
      dbTotalCount: result.dbTotalCount,
      dbCount: result.dbCount,
      diskCount: result.diskCount,
      missingCount: result.missingIds.length,
      failedCount: result.failedIds.length,
      skippedOtherVaultCount: result.skippedOtherVaultCount,
      missingIdSamples: result.missingIds.slice(0, 12),
      failedIdSamples: result.failedIds.slice(0, 12)
    })

    // 规划路径不做会话水合（慢且易触发二次确认）；同步结束后再补缺库会话
  } catch (e) {
    logger.warn('[IncrementalSync] session flushPending before sync failed:', e as Error)
  }
}

export function registerIncrementalSyncIPC() {
  ipcMain.handle('incrementalSync:getConfig', async () => {
    await ensureSyncServicesInitialized()
    if (syncService) {
      return syncService.getConfig()
    }
    return getDefaultSyncConfig()
  })

  ipcMain.handle('incrementalSync:updateConfig', async (_, config: Partial<S3SyncConfig>) => {
    const merged = {
      ...getDefaultSyncConfig(),
      ...config
    }
    await createSyncService(merged)
    await syncService!.updateConfig(merged)
    return { success: true }
  })

  ipcMain.handle('incrementalSync:testConnection', async (_, config?: Partial<S3SyncConfig>) => {
    const syncRoot = await pathService.getRootDirectory()
    let clientToTest: IncrementalS3Client | IncrementalWebDavClient
    if (config) {
      const merged = {
        ...getDefaultSyncConfig(),
        ...config
      }
      if (merged.target === 'webdav' && merged.webdavUrl) {
        clientToTest = new IncrementalWebDavClient(
          merged.webdavUrl,
          merged.accessKey,
          merged.secretKey,
          merged.path,
          merged.chunkConcurrency
        )
      } else {
        clientToTest = new IncrementalS3Client(
          merged.endpoint,
          merged.region,
          merged.bucket,
          merged.accessKey,
          merged.secretKey,
          merged.path
        )
      }
      clientToTest.setVaultPath(syncRoot)
    } else {
      const ok = await (await getSyncService()).testConnection()
      if (!ok) {
        throw new Error(
          i18n.t(
            'auto.apps.desktop.src.main.ipc.incremental.sync.ipc.L270',
            '连接测试失败，请检查配置信息'
          )
        )
      }
      return true
    }

    await clientToTest.listFiles()
    return true
  })

  ipcMain.handle('incrementalSync:sync', async (event, runOptions) => {
    await flushPendingAgentSessionsBeforeSync('full')
    const service = await getSyncService()
    const remoteManifest = await service.getRemoteManifest()
    await reconcileAgentAvatarsBeforeScan(Object.keys(remoteManifest.removed ?? {}))
    const result = await (
      await getOrchestrator()
    ).sync((progress) => {
      event.sender.send('incrementalSync:progress', progress)
    }, runOptions)
    await afterIncrementalSync(result)
    return result
  })

  ipcMain.handle('incrementalSync:getLocalManifest', async () => {
    return (await getSyncService()).getLocalManifest()
  })

  ipcMain.handle('incrementalSync:getRemoteManifest', async () => {
    return (await getSyncService()).getRemoteManifest()
  })

  ipcMain.handle('incrementalSync:refreshLocalManifest', async () => {
    return (await getSyncService()).refreshLocalManifest()
  })

  ipcMain.handle('incrementalSync:getLastSyncConflicts', async () => {
    return (await getSyncService()).getLastSyncConflicts()
  })

  ipcMain.handle('incrementalSync:planSync', async (_, runOptions) => {
    await flushPendingAgentSessionsBeforeSync('pending-only')
    const service = await getSyncService()
    const config = await service.getConfig()
    if (!config.enabled) {
      throw new S3NotConfiguredError()
    }

    service.clearPlanManifestCache()
    await vaultService.syncRegistryWithDisk()
    const remoteManifest = await service.getRemoteManifest()
    await reconcileAgentAvatarsBeforeScan(Object.keys(remoteManifest.removed ?? {}))
    let context = await resolveSyncPlanContext()

    const localManifest = await service.buildLocalManifest()
    service.setPlanManifestCache(localManifest, remoteManifest)
    const manifestScopes = collectManifestVaultScopes(localManifest, remoteManifest)
    const pruned = await vaultService.pruneOrphanRegistryVaults(
      manifestScopes,
      context.diskVaultNames
    )
    if (pruned.length > 0) {
      notifyVaultRegistryUpdated()
      context = await resolveSyncPlanContext()
    }

    try {
      let preview = await service.planSync(context, runOptions as never)
      const unknown = preview.boundaryIssues.unknownVaultPaths.filter(
        (name) => name !== '__root__' && name !== '__unknown__'
      )
      if (unknown.length > 0) {
        await vaultService.ensureVaultsRegistered(unknown)
        notifyVaultRegistryUpdated()
        context = await resolveSyncPlanContext()
        service.clearPlanManifestCache()
        preview = await service.planSync(context, runOptions as never)
      }
      if (pruned.length > 0) {
        preview = { ...preview, prunedRegistryVaults: pruned }
      }
      return preview
    } finally {
      service.clearPreparedManifestCache()
    }
  })

  ipcMain.handle('incrementalSync:readVaultRegistryFingerprint', async () => {
    const root = await pathService.getRootDirectory()
    const nodeFs = createNodeFileSystem()
    const registryPath = path.join(root, 'vault_registry.json')
    return readVaultRegistryFingerprint(
      {
        exists: (p) => nodeFs.exists(p),
        stat: async (p) => {
          const stat = await fs.promises.stat(p)
          return { mtimeMs: stat.mtimeMs }
        },
        readFile: (p) => fs.promises.readFile(p, 'utf8')
      },
      registryPath
    )
  })

  ipcMain.handle(
    'incrementalSync:evaluatePlanDrift',
    async (_, baseline: IncrementalSyncPlanReuseBaseline) => {
      const service = await getSyncService()
      const local = await service.buildLocalManifest()
      const remote = await service.getRemoteManifest()
      return evaluateIncrementalSyncPlanDrift(baseline, local, remote)
    }
  )

  ipcMain.handle(
    'incrementalSync:orchestratedSync',
    async (event, runOptions?: IncrementalSyncRunOptions) => {
      const publishProgress = (progress: SyncProgressEvent) => {
        event.sender.send('incrementalSync:progress', progress)
      }
      publishProgress({
        phase: 'comparing',
        current: 0,
        total: 1,
        statusText: 'data_sync.progress_registering_vaults'
      })
      await flushPendingAgentSessionsBeforeSync('full')
      const autoRegisteredVaults = await ensureVaultsForIncrementalSync(runOptions)
      ;(await getSyncService()).clearPreparedManifestCache()
      const result = await (
        await getOrchestrator()
      ).sync((progress) => {
        publishProgress(progress)
      }, runOptions)
      await afterIncrementalSync(result)
      return { ...result, autoRegisteredVaults }
    }
  )

  ipcMain.handle('incrementalSync:getSyncHistory', async (_, limit?: number) => {
    return (await getOrchestrator()).getSyncHistory(limit)
  })

  ipcMain.handle('incrementalSync:getLastSyncSummary', async () => {
    return (await getOrchestrator()).getSyncHistory(1).then((logs) => {
      if (logs.length > 0 && logs[0]!.success) {
        return logs[0]!.summary
      }
      return null
    })
  })
}

export function resetSyncService() {
  syncService = null
  orchestrator = null
}
