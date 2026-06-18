export interface ArchiveRestoreRebootstrapOptions {
  /** 默认 true；大体积 Flutter 旧包导入时改为 false，避免阻塞 UI 数分钟 */
  blockingResync?: boolean
  /** 默认 false；大体积导入时改为 true，总结索引在后台补扫 */
  deferSummaryScan?: boolean
}

export interface MobileArchiveDbBridge {
  /** 导出前刷盘设置并对 SQLite 执行 WAL checkpoint */
  flushBeforeExport(): Promise<void>
  /** 读取快照保留上限（-1 表示不限制） */
  getMaxSnapshotCount(): Promise<number>
  exportDevicePreferences(): Promise<Record<string, unknown>>
  importDevicePreferences(prefs: Record<string, unknown>): Promise<void>
  /** 全量导入前读取需保留的本地设置（如 cloud_sync_config） */
  readPreservedImportSettings(): Promise<{ cloud_sync_config?: unknown }>
  getAgentDatabaseUri(): Promise<string | null>
  /**
   * 关闭当前连接、替换磁盘上的 Agent 库文件，并热重载运行时（无需重启应用）。
   */
  replaceAgentDatabaseFrom(sourceUri: string): Promise<void>
  /** 全量恢复期间暂停 watcher / MCP，与 Flutter 恢复前 quiesce 对齐 */
  runArchiveImportQuiesced<T>(fn: () => Promise<T>): Promise<T>
  /** 工作区与数据库还原后全量重扫 vault / 日记索引 */
  rebootstrapAfterArchiveRestore(options?: ArchiveRestoreRebootstrapOptions): Promise<void>
  /** Flutter 旧版 ZIP（无 manifest）全量迁移到 staging 目录 */
  importLegacyFlutterZip?(
    extractDir: string,
    stagingRoot: string,
    options?: { onCopyProgress?: (entryPath: string) => void }
  ): Promise<void>
}

/** ZIP 内遗留用户头像路径（桌面导出兼容） */
export const ARCHIVE_USER_AVATARS_ZIP_PREFIX = 'user-data/UserAvatars'

export const MOBILE_ARCHIVE_DB_ZIP_NAME = 'database/baishou_agent.db'
