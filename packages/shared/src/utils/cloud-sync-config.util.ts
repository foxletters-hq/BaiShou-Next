export type RemoteCloudSyncTarget = 'local' | 's3' | 'webdav'

export type RemoteCloudSyncConfigFields = {
  target: RemoteCloudSyncTarget
  webdavUrl?: string
  webdavUsername?: string
  webdavPassword?: string
  s3Endpoint?: string
  s3Bucket?: string
  s3AccessKey?: string
  s3SecretKey?: string
}

function isFilled(value: string | undefined | null): boolean {
  const v = (value ?? '').trim()
  if (!v) return false
  if (v === 'https://' || v === 'http://') return false
  return true
}

/** 远程备份（S3 / WebDAV）必填项是否已填写，可避免用空配置打云端 API */
export function isRemoteCloudSyncConfigured(config: RemoteCloudSyncConfigFields): boolean {
  if (config.target === 'local') return false
  if (config.target === 'webdav') {
    return (
      isFilled(config.webdavUrl) &&
      isFilled(config.webdavUsername) &&
      isFilled(config.webdavPassword)
    )
  }
  if (config.target === 's3') {
    return (
      isFilled(config.s3Endpoint) &&
      isFilled(config.s3Bucket) &&
      isFilled(config.s3AccessKey) &&
      isFilled(config.s3SecretKey)
    )
  }
  return false
}

export function remoteCloudSyncTargetLabel(target: RemoteCloudSyncTarget): string {
  if (target === 's3') return 'S3'
  if (target === 'webdav') return 'WebDAV'
  return 'local'
}
