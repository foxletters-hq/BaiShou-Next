import {
  buildS3ListUrl,
  buildS3ObjectUrl,
  isIncrementalSyncReady,
  normalizeS3BasePath,
  s3FetchHeaders,
  signS3Request,
  type S3SyncConfig
} from '@baishou/shared'
import type { IFileSystem, IArchiveService, SettingsManagerService } from '@baishou/core-mobile'
import type { IStoragePathService } from '@baishou/core-mobile'
import { FileSystemUploadType, uploadAsync } from './mobile-http-transfer'
import { MobileIncrementalEngine } from './mobile-incremental-engine'
import type { MobileDataBootstrapper } from './mobile-bootstrapper.service'

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

  constructor(
    private readonly settingsManager: SettingsManagerService,
    private readonly archiveService: IArchiveService,
    private readonly pathService: IStoragePathService,
    private readonly fileSystem: IFileSystem,
    private readonly bootstrapper?: MobileDataBootstrapper,
    deviceId: string = `mobile-${Date.now()}`
  ) {
    this.engine = new MobileIncrementalEngine(pathService, fileSystem, deviceId)
  }

  private async afterSyncComplete(): Promise<void> {
    await this.bootstrapper?.resyncFromDisk()
  }

  private async vaultConfigPath(): Promise<string | null> {
    const vault = await this.pathService.getActiveVaultPath()
    if (!vault) return null
    return `${vault}/.baishou-s3.json`
  }

  async getConfig(): Promise<S3SyncConfig> {
    const vaultPath = await this.vaultConfigPath()
    if (vaultPath) {
      try {
        if (await this.fileSystem.exists(vaultPath)) {
          const raw = await this.fileSystem.readFile(vaultPath)
          const fromVault = JSON.parse(raw) as VaultSyncConfig
          return normalizeVaultConfig(fromVault)
        }
      } catch {
        // fall through to defaults
      }
    }
    return normalizeVaultConfig(null)
  }

  async saveConfig(config: Partial<S3SyncConfig>): Promise<void> {
    const merged = mergeConfig({ ...(await this.getConfig()), ...config })
    const vaultPath = await this.vaultConfigPath()
    if (!vaultPath) {
      throw new Error('No active vault found')
    }
    await this.fileSystem.writeFile(vaultPath, JSON.stringify(merged, null, 2))
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig()
    return isConfigReady(config)
  }

  async testConnection(configOverride?: Partial<S3SyncConfig>): Promise<void> {
    const config = normalizeVaultConfig({ ...(await this.getConfig()), ...configOverride })
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

    await this.afterSyncComplete()

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
    await this.afterSyncComplete()
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
    await this.afterSyncComplete()
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
        await this.fileSystem.unlink(zipPath)
      } catch {
        // ignore cleanup errors
      }
    }

    onProgress?.({ current: 3, total: 3, statusText: '完成' })

    return { uploaded: 1, downloaded: 0, conflicts: 0, skipped: 0 }
  }
}
