import * as FileSystem from 'expo-file-system/legacy'
import { signS3Request, type S3SyncConfig } from '@baishou/shared'
import type { SettingsManagerService, IArchiveService } from '@baishou/core-mobile'
import type { MobileStoragePathService } from './path.service'
import { MobileIncrementalEngine } from './mobile-incremental-engine'

export type IncrementalSyncProgress = {
  current: number
  total: number
  statusText?: string
}

export type IncrementalSyncResult = {
  uploaded: number
  downloaded: number
  conflicts: number
  skipped: number
}

const DEFAULT_CONFIG: S3SyncConfig = {
  enabled: false,
  endpoint: '',
  region: 'us-east-1',
  bucket: '',
  path: 'backup_sync',
  accessKey: '',
  secretKey: '',
  target: 's3'
}

function mergeConfig(partial?: Partial<S3SyncConfig> | null): S3SyncConfig {
  return { ...DEFAULT_CONFIG, ...partial }
}

function isConfigReady(config: S3SyncConfig): boolean {
  if (!config.enabled) return false
  if (config.target === 'webdav') {
    return Boolean(config.webdavUrl && config.accessKey)
  }
  return Boolean(config.endpoint && config.bucket && config.accessKey && config.secretKey)
}

async function testWebDav(config: S3SyncConfig): Promise<void> {
  const baseUrl = (config.webdavUrl || '').replace(/\/$/, '')
  const basePath = config.path?.startsWith('/') ? config.path : `/${config.path || ''}`
  const auth = `Basic ${btoa(`${config.accessKey}:${config.secretKey}`)}`
  const response = await fetch(`${baseUrl}${basePath}`, {
    method: 'PROPFIND',
    headers: {
      Authorization: auth,
      Depth: '0',
      'Content-Type': 'application/xml'
    }
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(`WebDAV PROPFIND failed: ${response.status} ${response.statusText}`)
  }
}

async function testS3(config: S3SyncConfig): Promise<void> {
  const uri = new URL(config.endpoint)
  const usePathStyle = uri.hostname.includes('localhost') || uri.hostname.includes('127.0.0.1')
  const prefix = config.path?.replace(/^\//, '') || ''
  const listUrl = usePathStyle
    ? `${uri.protocol}//${uri.hostname}${uri.port ? ':' + uri.port : ''}/${config.bucket}?list-type=2&max-keys=1&prefix=${encodeURIComponent(prefix)}`
    : `${uri.protocol}//${config.bucket}.${uri.hostname}${uri.port ? ':' + uri.port : ''}/?list-type=2&max-keys=1&prefix=${encodeURIComponent(prefix)}`

  const headers = await signS3Request(
    'GET',
    listUrl,
    config.region || 'us-east-1',
    config.accessKey,
    config.secretKey,
    null
  )
  const response = await fetch(listUrl, { method: 'GET', headers })
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

  const response = await FileSystem.uploadAsync(`${baseUrl}${remotePath}`, localZipPath, {
    httpMethod: 'PUT',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/zip'
    },
    uploadType: 1
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
  const uri = new URL(config.endpoint)
  const usePathStyle = uri.hostname.includes('localhost') || uri.hostname.includes('127.0.0.1')
  const basePath = config.path?.replace(/^\//, '') || ''
  const objectName = basePath ? `${basePath.replace(/\/?$/, '/')}${remoteName}` : remoteName

  const url = usePathStyle
    ? `${uri.protocol}//${uri.hostname}${uri.port ? ':' + uri.port : ''}/${config.bucket}/${objectName}`
    : `${uri.protocol}//${config.bucket}.${uri.hostname}${uri.port ? ':' + uri.port : ''}/${objectName}`

  const headers = await signS3Request(
    'PUT',
    url,
    config.region || 'us-east-1',
    config.accessKey,
    config.secretKey,
    null
  )

  const response = await FileSystem.uploadAsync(url, localZipPath, {
    httpMethod: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/zip'
    },
    uploadType: 1
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`S3 upload failed: ${response.status}`)
  }
}

export class MobileIncrementalSyncService {
  private readonly engine: MobileIncrementalEngine

  constructor(
    private readonly settingsManager: SettingsManagerService,
    private readonly archiveService: IArchiveService,
    private readonly pathService: MobileStoragePathService,
    deviceId: string = `mobile-${Date.now()}`
  ) {
    this.engine = new MobileIncrementalEngine(pathService, deviceId)
  }

  private async vaultConfigPath(): Promise<string | null> {
    const vault = await this.pathService.getActiveVaultPath()
    if (!vault) return null
    return `${vault}/.baishou-s3.json`
  }

  async getConfig(): Promise<S3SyncConfig> {
    const fromSettings =
      await this.settingsManager.get<Partial<S3SyncConfig>>('incremental_sync_config')
    const vaultPath = await this.vaultConfigPath()
    if (vaultPath) {
      try {
        const info = await FileSystem.getInfoAsync(vaultPath)
        if (info.exists) {
          const raw = await FileSystem.readAsStringAsync(vaultPath)
          const fromVault = JSON.parse(raw) as Partial<S3SyncConfig>
          return mergeConfig({ ...fromVault, ...fromSettings })
        }
      } catch {
        // fallback settings only
      }
    }
    return mergeConfig(fromSettings)
  }

  async saveConfig(config: Partial<S3SyncConfig>): Promise<void> {
    const merged = mergeConfig({ ...(await this.getConfig()), ...config })
    await this.settingsManager.set('incremental_sync_config', merged)
    const vaultPath = await this.vaultConfigPath()
    if (vaultPath) {
      await FileSystem.writeAsStringAsync(vaultPath, JSON.stringify(merged, null, 2))
    }
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig()
    return isConfigReady(config)
  }

  async testConnection(configOverride?: Partial<S3SyncConfig>): Promise<void> {
    const config = mergeConfig({ ...(await this.getConfig()), ...configOverride })
    if (config.target === 'webdav') {
      await testWebDav(config)
    } else {
      await testS3(config)
    }
  }

  /**
   * 三向合并增量同步（对齐桌面 ThreeWaySyncService.sync）
   */
  async sync(
    onProgress?: (progress: IncrementalSyncProgress) => void
  ): Promise<IncrementalSyncResult> {
    const config = await this.getConfig()
    if (!isConfigReady(config)) {
      throw new Error('增量同步未配置或已禁用')
    }

    const result = await this.engine.syncThreeWay(config, (current, total, statusText) => {
      onProgress?.({ current, total, statusText })
    })

    return {
      uploaded: result.uploaded,
      downloaded: result.downloaded,
      conflicts: result.conflicts,
      skipped: result.skipped
    }
  }

  async uploadOnly(
    onProgress?: (progress: IncrementalSyncProgress) => void
  ): Promise<IncrementalSyncResult> {
    const config = await this.getConfig()
    if (!isConfigReady(config)) throw new Error('增量同步未配置或已禁用')
    const result = await this.engine.uploadOnly(config, (c, t, s) =>
      onProgress?.({ current: c, total: t, statusText: s })
    )
    return {
      uploaded: result.uploaded,
      downloaded: 0,
      conflicts: 0,
      skipped: result.skipped
    }
  }

  async downloadOnly(
    onProgress?: (progress: IncrementalSyncProgress) => void
  ): Promise<IncrementalSyncResult> {
    const config = await this.getConfig()
    if (!isConfigReady(config)) throw new Error('增量同步未配置或已禁用')
    const result = await this.engine.downloadOnly(config, (c, t, s) =>
      onProgress?.({ current: c, total: t, statusText: s })
    )
    return {
      uploaded: 0,
      downloaded: result.downloaded,
      conflicts: 0,
      skipped: result.skipped
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
      throw new Error('增量同步未配置或已禁用')
    }

    onProgress?.({ current: 0, total: 3, statusText: '打包 vault 文件...' })
    const zipPath = await this.archiveService.exportToTempFile()
    if (!zipPath) {
      throw new Error('生成 vault 归档失败')
    }

    const remoteName = `BaiShou_IncrementalSync_${Date.now()}.zip`
    onProgress?.({ current: 1, total: 3, statusText: '连接远端...' })

    try {
      if (config.target === 'webdav') {
        await testWebDav(config)
        onProgress?.({ current: 2, total: 3, statusText: `上传 ${remoteName}...` })
        await uploadWebDav(config, zipPath, remoteName)
      } else {
        await testS3(config)
        onProgress?.({ current: 2, total: 3, statusText: `上传 ${remoteName}...` })
        await uploadS3(config, zipPath, remoteName)
      }
    } finally {
      try {
        await FileSystem.deleteAsync(zipPath, { idempotent: true })
      } catch {
        // ignore cleanup errors
      }
    }

    onProgress?.({ current: 3, total: 3, statusText: '完成' })

    return { uploaded: 1, downloaded: 0, conflicts: 0, skipped: 0 }
  }
}
