import type { S3SyncConfig } from '../types/version-control.types'
import { normalizeS3BasePath, normalizeS3Endpoint } from './s3-url'

/** 本地 `.baishou/sync-storage-id.txt`：与祖先快照绑定的目标存储标识 */
export const SYNC_STORAGE_ID_FILENAME = 'sync-storage-id.txt'

/**
 * 增量同步目标存储的唯一标识（S3 与 WebDAV 互不混用）。
 * 不含凭据，仅 target + 端点/URL + bucket + 路径前缀。
 */
export function getIncrementalSyncStorageId(config: S3SyncConfig): string {
  const pathPrefix = normalizeS3BasePath(config.path)
  if (config.target === 'webdav') {
    const url = (config.webdavUrl || '').trim().replace(/\/+$/, '').toLowerCase()
    return `webdav:${url}:${pathPrefix}`
  }
  const endpoint = normalizeS3Endpoint(config.endpoint || '')
    .replace(/\/+$/, '')
    .toLowerCase()
  const bucket = (config.bucket || '').trim().toLowerCase()
  return `s3:${endpoint}:${bucket}:${pathPrefix}`
}
