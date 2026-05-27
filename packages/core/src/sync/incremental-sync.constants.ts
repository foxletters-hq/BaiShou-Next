import type { S3SyncConfig } from '@baishou/shared'

export const INCREMENTAL_SYNC_MANIFEST_FILENAME = 'manifest.json'
export const INCREMENTAL_SYNC_CONFIG_FILENAME = '.baishou-s3.json'

export const DEFAULT_S3_SYNC_CONFIG: S3SyncConfig = {
  enabled: false,
  endpoint: '',
  region: '',
  bucket: '',
  path: 'backup_sync',
  accessKey: '',
  secretKey: '',
  chunkConcurrency: 5,
  fileConcurrency: 5
}
