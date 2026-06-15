export interface MobileArchiveDbBridge {
  flushBeforeExport(): Promise<void>
  exportDevicePreferences(): Promise<Record<string, unknown>>
  importDevicePreferences(prefs: Record<string, unknown>): Promise<void>
  /** 全量导入前读取需保留的本地设置（如 cloud_sync_config） */
  readPreservedImportSettings(): Promise<{ cloud_sync_config?: unknown }>
  getAgentDatabaseUri(): Promise<string | null>
  /** 用备份中的 SQLite 文件替换当前 Agent 库；返回是否需重启应用 */
  replaceAgentDatabaseFrom(sourceUri: string): Promise<boolean>
}

/** ZIP 内遗留用户头像路径（桌面导出兼容） */
export const ARCHIVE_USER_AVATARS_ZIP_PREFIX = 'user-data/UserAvatars'

export const MOBILE_ARCHIVE_DB_ZIP_NAME = 'database/baishou_agent.db'
