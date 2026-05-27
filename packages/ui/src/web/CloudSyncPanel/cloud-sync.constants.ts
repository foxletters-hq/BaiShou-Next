import type { SyncConfig } from './cloud-sync.types'

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  target: 'local',
  maxBackupCount: 20,
  maxSnapshotCount: 5,
  webdavUrl: 'https://',
  webdavUsername: '',
  webdavPassword: '',
  webdavPath: '/baishou_backup',
  s3Endpoint: 'https://',
  s3Region: '',
  s3Bucket: '',
  s3Path: '/baishou_backup',
  s3AccessKey: '',
  s3SecretKey: ''
}
