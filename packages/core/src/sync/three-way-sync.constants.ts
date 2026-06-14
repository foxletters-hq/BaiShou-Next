import type { S3SyncConfig } from '@baishou/shared'
import {
  SYNC_CONFIG_FILENAME,
  SYNC_MANIFEST_FILENAME,
  SYNC_REMOTE_SNAPSHOT_FILENAME
} from '@baishou/shared'

export { SYNC_MANIFEST_FILENAME, SYNC_REMOTE_SNAPSHOT_FILENAME }
export const S3_CONFIG_FILE = SYNC_CONFIG_FILENAME

export const DEFAULT_S3_SYNC_CONFIG: S3SyncConfig = {
  enabled: false,
  endpoint: '',
  region: '',
  bucket: '',
  path: 'backup_sync',
  accessKey: '',
  secretKey: '',
  chunkConcurrency: 5,
  fileConcurrency: 5,
  maxDivergencePercent: 100
}
