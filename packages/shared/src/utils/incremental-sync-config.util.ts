import type { S3SyncConfig } from '../types/version-control.types'
import {
  SYNC_CONFIG_FILENAME,
  SYNC_MANIFEST_FILENAME,
  SYNC_REMOTE_SNAPSHOT_FILENAME
} from '../constants/incremental-sync.constants'
import { SYNC_STORAGE_ID_FILENAME } from './incremental-sync-storage.util'

/** 文件同步是否已启用且凭据完整（桌面顶栏 / 移动端日记页入口共用） */
export function isIncrementalSyncReady(config: Partial<S3SyncConfig> | null | undefined): boolean {
  if (!config?.enabled) return false
  if (config.target === 'webdav') {
    return Boolean(config.webdavUrl && config.accessKey)
  }
  return Boolean(config.endpoint && config.bucket && config.accessKey && config.secretKey)
}

export interface IncrementalSyncFileStorage {
  exists(path: string): Promise<boolean> | boolean
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  unlink(path: string): Promise<void>
}

/** 增量同步配置文件路径（存储根目录） */
export function getRootIncrementalSyncConfigPath(syncRoot: string): string {
  const root = syncRoot.replace(/\\/g, '/').replace(/\/$/, '')
  return `${root}/${SYNC_CONFIG_FILENAME}`
}

/**
 * 将 legacy vault 内 `.baishou-s3.json` 迁移到存储根，并返回最终配置路径。
 */
export async function migrateLegacyIncrementalSyncConfig(
  syncRoot: string,
  activeVaultPath: string | null | undefined,
  storage: IncrementalSyncFileStorage
): Promise<string> {
  const rootConfig = getRootIncrementalSyncConfigPath(syncRoot)
  if (await storage.exists(rootConfig)) {
    return rootConfig
  }

  if (activeVaultPath) {
    const legacyConfig = `${activeVaultPath.replace(/\\/g, '/').replace(/\/$/, '')}/${SYNC_CONFIG_FILENAME}`
    if (await storage.exists(legacyConfig)) {
      const raw = await storage.read(legacyConfig)
      await storage.write(rootConfig, raw)
      try {
        await storage.unlink(legacyConfig)
      } catch {
        // ignore
      }
    }
  }

  return rootConfig
}

/** 全量备份恢复后应清空的增量同步元数据（保留 device-id 与 sync-log） */
export const INCREMENTAL_SYNC_META_RESET_FILENAMES = [
  SYNC_MANIFEST_FILENAME,
  SYNC_REMOTE_SNAPSHOT_FILENAME,
  SYNC_STORAGE_ID_FILENAME
] as const

/** 全量 ZIP 备份应排除的存储根条目（增量同步元数据、Git 仓库等） */
export const FULL_BACKUP_EXCLUDED_ROOT_NAMES = new Set([
  '.baishou',
  SYNC_CONFIG_FILENAME,
  '.git',
  '.baishou-git.json'
])

/**
 * 全量备份恢复后重置增量同步状态，避免过期 manifest 污染三向合并。
 */
export async function resetIncrementalSyncMetaAfterFullRestore(
  syncMetaDir: string,
  storage: IncrementalSyncFileStorage
): Promise<void> {
  const meta = syncMetaDir.replace(/\\/g, '/').replace(/\/$/, '')
  for (const name of INCREMENTAL_SYNC_META_RESET_FILENAMES) {
    const filePath = `${meta}/${name}`
    if (await storage.exists(filePath)) {
      try {
        await storage.unlink(filePath)
      } catch {
        // ignore
      }
    }
  }
}
