import { ipcMain, app } from 'electron'
import * as crypto from 'crypto'
import * as path from 'path'
import {
  ThreeWaySyncService,
  SyncOrchestrator,
  OperationLogService,
  type IIncrementalSyncService
} from '@baishou/core-desktop'
import type { S3SyncConfig } from '@baishou/shared'
import { IncrementalS3Client } from '../services/incremental-s3.client'
import { IncrementalWebDavClient } from '../services/incremental-webdav.client'
import { pathService } from './vault.ipc'
import { getGitService } from './git-sync.ipc'

let syncService: IIncrementalSyncService | null = null
let orchestrator: SyncOrchestrator | null = null

function getDefaultSyncConfig(): S3SyncConfig {
  return {
    enabled: false,
    endpoint: '',
    region: '',
    bucket: '',
    path: 'backup_sync',
    accessKey: '',
    secretKey: '',
    fileConcurrency: 5,
    chunkConcurrency: 5,
    maxDivergencePercent: 100
  }
}

async function ensureSyncServicesInitialized(): Promise<void> {
  if (syncService) return

  const vaultPath = await pathService.getActiveVaultPath()
  if (!vaultPath) return

  const fs = await import('fs')
  const configPath = path.join(vaultPath, '.baishou-s3.json')
  if (!fs.existsSync(configPath)) return

  try {
    const raw = await fs.promises.readFile(configPath, 'utf8')
    const saved = JSON.parse(raw) as Partial<S3SyncConfig>
    await createSyncService(saved as S3SyncConfig)
    if (syncService) await syncService.getConfig()
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

async function createSyncService(config: S3SyncConfig): Promise<IIncrementalSyncService> {
  const vaultPath = await pathService.getActiveVaultPath()
  const deviceId = 'desktop-' + crypto.randomUUID().substring(0, 8)

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

  if (vaultPath) {
    client.setVaultPath(vaultPath)
  }

  syncService = new ThreeWaySyncService(pathService, client, deviceId)

  const logDir = vaultPath
    ? path.join(vaultPath, '.baishou', 'sync-log')
    : path.join(app.getPath('userData'), 'sync-log')
  const logService = new OperationLogService(logDir)

  const gitService = getGitService()

  orchestrator = new SyncOrchestrator(syncService, logService, gitService, deviceId)

  return syncService
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
      enabled: true,
      ...config
    }
    await createSyncService(merged)
    await syncService!.updateConfig(merged)
    return { success: true }
  })

  ipcMain.handle('incrementalSync:testConnection', async (_, config?: Partial<S3SyncConfig>) => {
    const vaultPath = await pathService.getActiveVaultPath()
    let clientToTest: any
    if (config) {
      const merged = {
        ...getDefaultSyncConfig(),
        enabled: true,
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
      if (vaultPath) {
        clientToTest.setVaultPath(vaultPath)
      }
    } else {
      try {
        const ok = await (await getSyncService()).testConnection()
        if (!ok) {
          throw new Error('连接测试失败，请检查配置信息')
        }
        return true
      } catch (err) {
        throw err
      }
    }

    try {
      await clientToTest.listFiles()
      return true
    } catch (err) {
      throw err
    }
  })

  ipcMain.handle('incrementalSync:sync', async (event) => {
    const result = await (await getOrchestrator()).sync((progress) => {
      event.sender.send('incrementalSync:progress', progress)
    })
    if (result.downloaded.length > 0 || result.deletedLocal.length > 0) {
      const { globalBootstrapper } = await import('../services/bootstrapper.service')
      await globalBootstrapper.fullyResyncAllEcosystems()
    }
    return result
  })

  ipcMain.handle('incrementalSync:uploadOnly', async (event) => {
    return (await getOrchestrator()).uploadOnly((progress) => {
      event.sender.send('incrementalSync:progress', progress)
    })
  })

  ipcMain.handle('incrementalSync:downloadOnly', async (event) => {
    const result = await (await getOrchestrator()).downloadOnly((progress) => {
      event.sender.send('incrementalSync:progress', progress)
    })
    if (result.downloaded.length > 0 || result.deletedLocal.length > 0) {
      const { globalBootstrapper } = await import('../services/bootstrapper.service')
      await globalBootstrapper.fullyResyncAllEcosystems()
    }
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

  // ── 编排器一键同步 API ─────────────────────────────────────

  ipcMain.handle('incrementalSync:orchestratedSync', async (event) => {
    const result = await (await getOrchestrator()).sync((progress) => {
      event.sender.send('incrementalSync:progress', progress)
    })
    if (result.downloaded.length > 0 || result.deletedLocal.length > 0) {
      const { globalBootstrapper } = await import('../services/bootstrapper.service')
      await globalBootstrapper.fullyResyncAllEcosystems()
    }
    return result
  })

  ipcMain.handle('incrementalSync:orchestratedUploadOnly', async (event) => {
    return (await getOrchestrator()).uploadOnly((progress) => {
      event.sender.send('incrementalSync:progress', progress)
    })
  })

  ipcMain.handle('incrementalSync:orchestratedDownloadOnly', async (event) => {
    const result = await (await getOrchestrator()).downloadOnly((progress) => {
      event.sender.send('incrementalSync:progress', progress)
    })
    if (result.downloaded.length > 0 || result.deletedLocal.length > 0) {
      const { globalBootstrapper } = await import('../services/bootstrapper.service')
      await globalBootstrapper.fullyResyncAllEcosystems()
    }
    return result
  })

  ipcMain.handle('incrementalSync:getSyncHistory', async (_, limit?: number) => {
    return (await getOrchestrator()).getSyncHistory(limit)
  })

  ipcMain.handle('incrementalSync:getLastSyncSummary', async () => {
    return (await getOrchestrator())
      .getSyncHistory(1)
      .then((logs) => {
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
