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
  fileConcurrency: 5,
  chunkConcurrency: 5,
  maxDivergencePercent: 100
}

export type VaultSyncConfig = Partial<S3SyncConfig> & {
  s3AccessKey?: string
  s3SecretKey?: string
  s3Path?: string
  webdavUsername?: string
  webdavPassword?: string
  webdavPath?: string
}

export function normalizeVaultConfig(partial?: VaultSyncConfig | null): S3SyncConfig {
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

export function mergeConfig(partial?: Partial<S3SyncConfig> | null): S3SyncConfig {
  return { ...DEFAULT_CONFIG, ...partial }
}

export function isConfigReady(config: S3SyncConfig): boolean {
  return isIncrementalSyncReady(config)
}

export async function testWebDav(
  config: S3SyncConfig,
  fileSystem: IFileSystem,
  syncRoot: string
): Promise<void> {
  const client = new MobileIncrementalCloudClient(config, fileSystem)
  client.setVaultPath(syncRoot)
  await client.listFiles()
}

export async function testS3(config: S3SyncConfig): Promise<void> {
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

export async function uploadWebDav(
  config: S3SyncConfig,
  localZipPath: string,
  remoteName: string
): Promise<void> {
  const baseUrl = normalizeWebDavBaseUrl(config.webdavUrl)
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

export async function uploadS3(
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
