import * as fs from 'fs'
import * as path from 'path'
import {
  ThreeWaySyncService,
  SyncOrchestrator,
  OperationLogService,
  type IIncrementalSyncService
} from '@baishou/core-desktop'
import {
  DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
  resolveSyncDeviceId,
  migrateLegacyIncrementalSyncConfig,
  type S3SyncConfig
} from '@baishou/shared'
import { IncrementalS3Client } from '../services/incremental-s3.client'
import { IncrementalWebDavClient } from '../services/incremental-webdav.client'
import { pathService } from './vault.ipc'
import { getGitService } from './git-sync.ipc'

let syncService: IIncrementalSyncService | null = null
let orchestrator: SyncOrchestrator | null = null

export function getDefaultSyncConfig(): S3SyncConfig {
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

export async function ensureSyncServicesInitialized(): Promise<void> {
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

export function peekSyncService(): IIncrementalSyncService | null {
  return syncService
}

export async function getSyncService(): Promise<IIncrementalSyncService> {
  await ensureSyncServicesInitialized()
  if (!syncService) {
    throw new Error('Incremental sync service not initialized. Please update config first.')
  }
  return syncService
}

export async function getOrchestrator(): Promise<SyncOrchestrator> {
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

function createConfiguredSyncClient(
  config: S3SyncConfig
): IncrementalS3Client | IncrementalWebDavClient {
  if (config.target === 'webdav') {
    return new IncrementalWebDavClient(
      config.webdavUrl || '',
      config.accessKey || '',
      config.secretKey || '',
      config.path || '',
      config.chunkConcurrency
    )
  }
  return new IncrementalS3Client(
    config.endpoint || '',
    config.region || '',
    config.bucket || '',
    config.accessKey || '',
    config.secretKey || '',
    config.path || '',
    config.chunkConcurrency
  )
}

export async function createSyncService(config: S3SyncConfig): Promise<IIncrementalSyncService> {
  const syncRoot = await pathService.getRootDirectory()
  const syncMetaDir = path.join(syncRoot, '.baishou')
  const deviceId = await resolveDesktopDeviceId(syncMetaDir)

  const client = createConfiguredSyncClient(config)
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

export function resetSyncService() {
  syncService = null
  orchestrator = null
}
