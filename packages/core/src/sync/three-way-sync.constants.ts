import type { S3SyncConfig } from '@baishou/shared'

export const MANIFEST_FILENAME_V2 = 'manifest-v2.json'
export const REMOTE_SNAPSHOT_FILENAME = 'last-remote-manifest-v2.json'

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

export const S3_CONFIG_FILE = '.baishou-s3.json'
