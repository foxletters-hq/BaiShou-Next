import {
  buildS3ListUrl,
  buildS3ObjectUrl,
  DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
  isIncrementalSyncReady,
  normalizeS3BasePath,
  normalizeWebDavBaseUrl,
  s3FetchHeaders,
  signS3Request,
  type S3SyncConfig
} from '@baishou/shared'
import type { IFileSystem } from '@baishou/core-mobile'
import { FileSystemUploadType, uploadAsync } from './mobile-http-transfer'
import { MobileIncrementalCloudClient } from './mobile-incremental-cloud.client'

export const DEFAULT_CONFIG: S3SyncConfig = {
  enabled: false,
  endpoint: '',
  region: 'us-east-1',
  bucket: '',
  path: DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
  accessKey: '',
  secretKey: '',
  target: 's3',
  s3AccessKey: '',
  s3SecretKey: '',
  s3Path: DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
  webdavUsername: '',
  webdavPassword: '',
  webdavPath: DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
  webdavUrl: '',
  fileConcurrency: 5,
  chunkConcurrency: 5,
  maxDivergencePercent: 100
}

export type VaultSyncConfig = Partial<S3SyncConfig>

function pickSideText(
  sideValue: string | undefined,
  sharedFallback: string | undefined,
  useSharedFallback: boolean
): string {
  if (sideValue !== undefined) return sideValue.trim()
  if (useSharedFallback) return (sharedFallback || '').trim()
  return ''
}

function pickSidePath(
  sideValue: string | undefined,
  sharedFallback: string | undefined,
  useSharedFallback: boolean
): string {
  if (sideValue !== undefined && sideValue !== '') return sideValue
  if (useSharedFallback && sharedFallback) return sharedFallback
  return DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH
}

/**
 * 加载/合并配置：保留 S3 / WebDAV 分端字段，并把当前 target 投影到运行时 accessKey/secretKey/path。
 * 兼容仅有共享字段的旧配置（只回填到当时的 target）。
 */
export function normalizeVaultConfig(partial?: VaultSyncConfig | null): S3SyncConfig {
  const base = mergeConfig(partial)
  const target = partial?.target === 'webdav' ? 'webdav' : 's3'

  const s3AccessKey = pickSideText(partial?.s3AccessKey, partial?.accessKey, target === 's3')
  const s3SecretKey = pickSideText(partial?.s3SecretKey, partial?.secretKey, target === 's3')
  const s3Path = pickSidePath(partial?.s3Path, partial?.path, target === 's3')

  const webdavUsername = pickSideText(
    partial?.webdavUsername,
    partial?.accessKey,
    target === 'webdav'
  )
  const webdavPassword = pickSideText(
    partial?.webdavPassword,
    partial?.secretKey,
    target === 'webdav'
  )
  const webdavPath = pickSidePath(partial?.webdavPath, partial?.path, target === 'webdav')

  return projectIncrementalSyncRuntime({
    ...base,
    target,
    s3AccessKey,
    s3SecretKey,
    s3Path,
    webdavUsername,
    webdavPassword,
    webdavPath,
    webdavUrl: partial?.webdavUrl ?? base.webdavUrl ?? '',
    fileConcurrency: partial?.fileConcurrency ?? base.fileConcurrency,
    chunkConcurrency: partial?.chunkConcurrency ?? base.chunkConcurrency
  })
}

/** 用分端字段刷新运行时 accessKey / secretKey / path */
export function projectIncrementalSyncRuntime(config: S3SyncConfig): S3SyncConfig {
  const target = config.target === 'webdav' ? 'webdav' : 's3'
  if (target === 'webdav') {
    return {
      ...config,
      target: 'webdav',
      accessKey: (config.webdavUsername ?? '').trim(),
      secretKey: (config.webdavPassword ?? '').trim(),
      path: config.webdavPath || DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH
    }
  }
  return {
    ...config,
    target: 's3',
    accessKey: (config.s3AccessKey ?? '').trim(),
    secretKey: (config.s3SecretKey ?? '').trim(),
    path: config.s3Path || DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH
  }
}

export function mergeConfig(partial?: Partial<S3SyncConfig> | null): S3SyncConfig {
  return { ...DEFAULT_CONFIG, ...partial }
}

export function isConfigReady(config: S3SyncConfig): boolean {
  return isIncrementalSyncReady(projectIncrementalSyncRuntime(config))
}

export async function testWebDav(
  config: S3SyncConfig,
  fileSystem: IFileSystem,
  syncRoot: string
): Promise<void> {
  const client = new MobileIncrementalCloudClient(projectIncrementalSyncRuntime(config), fileSystem)
  client.setVaultPath(syncRoot)
  await client.listFiles()
}

export async function testS3(config: S3SyncConfig): Promise<void> {
  const runtime = projectIncrementalSyncRuntime(config)
  const prefix = normalizeS3BasePath(runtime.path)
  const listUrl = buildS3ListUrl({
    endpoint: runtime.endpoint,
    bucket: runtime.bucket,
    prefix,
    maxKeys: 1
  })

  const signed = await signS3Request(
    'GET',
    listUrl,
    runtime.region || 'us-east-1',
    runtime.accessKey,
    runtime.secretKey,
    null
  )
  const response = await fetch(listUrl, { method: 'GET', headers: s3FetchHeaders(signed) })
  if (!response.ok) {
    throw new Error(`S3 list failed: ${response.status} ${response.statusText}`)
  }
}

export async function uploadWebDav(
  config: S3SyncConfig,
  localZipPath: string,
  remoteName: string
): Promise<void> {
  const runtime = projectIncrementalSyncRuntime(config)
  const baseUrl = normalizeWebDavBaseUrl(runtime.webdavUrl)
  let basePath = runtime.path?.startsWith('/') ? runtime.path : `/${runtime.path || ''}`
  if (!basePath.endsWith('/')) basePath += '/'
  const remotePath = `${basePath}${remoteName}`
  const auth = `Basic ${btoa(`${runtime.accessKey}:${runtime.secretKey}`)}`

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

export async function uploadS3(
  config: S3SyncConfig,
  localZipPath: string,
  remoteName: string
): Promise<void> {
  const runtime = projectIncrementalSyncRuntime(config)
  const objectName = `${normalizeS3BasePath(runtime.path)}${remoteName}`
  const url = buildS3ObjectUrl({
    endpoint: runtime.endpoint,
    bucket: runtime.bucket,
    objectKey: objectName
  })

  const contentType = 'application/zip'
  const signed = await signS3Request(
    'PUT',
    url,
    runtime.region || 'us-east-1',
    runtime.accessKey,
    runtime.secretKey,
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
