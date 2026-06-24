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
  type IncrementalSyncPlanReuseBaseline,
  type IncrementalSyncRunOptions,
  type SyncProgressEvent,
  type S3SyncConfig
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

  syncService = new ThreeWaySyncService(pathService, client, deviceId)

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
  return (
    result.downloaded.length > 0 ||
    result.deletedLocal.length > 0 ||
    (result.uploaded?.length ?? 0) > 0 ||
    (result.deletedRemote?.length ?? 0) > 0 ||
    (result.conflicted?.length ?? 0) > 0
  )
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
  if (!options?.force && !incrementalSyncNeedsBootstrap(result)) return

  const { globalBootstrapper } = await import('../services/bootstrapper.service')
  await globalBootstrapper.fullyResyncAllEcosystems()

  const { schedulePostSyncDiaryBatchEmbed } = await import(
    '../services/controlled-diary-batch-embed.service'
  )
  schedulePostSyncDiaryBatchEmbed()
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
        throw new Error('连接测试失败，请检查配置信息')
      }
      return true
    }

    await clientToTest.listFiles()
    return true
  })

  ipcMain.handle('incrementalSync:sync', async (event, runOptions) => {
    const result = await (
      await getOrchestrator()
    ).sync((progress) => {
      event.sender.send('incrementalSync:progress', progress)
    }, runOptions)
    await afterIncrementalSync(result, { force: true })
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
    const service = await getSyncService()
    const config = await service.getConfig()
    if (!config.enabled) {
      throw new S3NotConfiguredError()
    }

    service.clearPlanManifestCache()
    await vaultService.syncRegistryWithDisk()
    let context = await resolveSyncPlanContext()

    const localManifest = await service.buildLocalManifest()
    const remoteManifest = await service.getRemoteManifest()
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

  ipcMain.handle('incrementalSync:orchestratedSync', async (event, runOptions?: IncrementalSyncRunOptions) => {
    const publishProgress = (progress: SyncProgressEvent) => {
      event.sender.send('incrementalSync:progress', progress)
    }
    publishProgress({
      phase: 'comparing',
      current: 0,
      total: 1,
      statusText: 'data_sync.progress_registering_vaults'
    })
    const autoRegisteredVaults = await ensureVaultsForIncrementalSync(runOptions)
    ;(await getSyncService()).clearPreparedManifestCache()
    const result = await (
      await getOrchestrator()
    ).sync((progress) => {
      publishProgress(progress)
    }, runOptions)
    await afterIncrementalSync(result, { force: true })
    return { ...result, autoRegisteredVaults }
  })

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
