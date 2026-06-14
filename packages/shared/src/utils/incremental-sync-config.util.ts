import type { S3SyncConfig } from '../types/version-control.types'

/** 文件同步是否已启用且凭据完整（桌面顶栏 / 移动端日记页入口共用） */
export function isIncrementalSyncReady(config: Partial<S3SyncConfig> | null | undefined): boolean {
  if (!config?.enabled) return false
  if (config.target === 'webdav') {
    return Boolean(config.webdavUrl && config.accessKey)
  }
  return Boolean(config.endpoint && config.bucket && config.accessKey && config.secretKey)
}
