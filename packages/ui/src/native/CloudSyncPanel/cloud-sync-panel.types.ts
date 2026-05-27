export interface CloudSyncConfig {
  target: string
  maxBackupCount: number
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavPath: string
  s3Endpoint: string
  s3Region: string
  s3Bucket: string
  s3Path: string
  s3AccessKey: string
  s3SecretKey: string
}

export interface CloudSyncRecord {
  filename: string
  lastModified: string
  sizeInBytes: number
}

export interface CloudSyncPanelProps {
  config: CloudSyncConfig
  onSaveConfig?: (config: CloudSyncConfig) => void
  onSyncNow?: () => Promise<void>
  records?: CloudSyncRecord[]
  isLoading?: boolean
}

export interface CloudSyncTargetOption {
  key: string
  label: string
}
