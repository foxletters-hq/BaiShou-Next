import i18n from 'i18next'
import { ipcMain } from 'electron'
import type { S3SyncConfig } from '@baishou/shared'
import { IncrementalS3Client } from '../services/incremental-s3.client'
import { IncrementalWebDavClient } from '../services/incremental-webdav.client'
import { pathService } from './vault.ipc'
import {
  createSyncService,
  ensureSyncServicesInitialized,
  getDefaultSyncConfig,
  getOrchestrator,
  getSyncService,
  peekSyncService,
  resetSyncService
} from './incremental-sync-service.factory'
import {
  afterIncrementalSync,
  flushPendingAgentSessionsBeforeSync,
  reconcileAgentAvatarsBeforeScan,
  registerIncrementalSyncPlanIPC
} from './incremental-sync-plan.ipc'

export { resetSyncService }

export function registerIncrementalSyncIPC() {
  registerIncrementalSyncPlanIPC()

  ipcMain.handle('incrementalSync:getConfig', async () => {
    await ensureSyncServicesInitialized()
    const service = peekSyncService()
    if (service) {
      return service.getConfig()
    }
    return getDefaultSyncConfig()
  })

  ipcMain.handle('incrementalSync:updateConfig', async (_, config: Partial<S3SyncConfig>) => {
    const merged = {
      ...getDefaultSyncConfig(),
      ...config
    }
    const service = await createSyncService(merged)
    await service.updateConfig(merged)
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
