export interface ImportResult {
  fileCount: number
  profileRestored: boolean
  snapshotPath?: string
  /** 移动端替换 SQLite 主库后需完全重启应用 */
  needsRestart?: boolean
}

export interface SnapshotMeta {
  filename: string
  createdAt: number
  size: number
}

export interface IArchiveService {
  /**
   * 导出为临时 ZIP 文件。内部需要主动过滤 `-wal`, `-shm`，并且热注入 `config/device_preferences.json`。
   * 返回生成的 ZIP 文件的绝对路径（在临时目录中）
   */
  exportToTempFile(): Promise<string | null>

  /**
   * 导出为本地 ZIP 文件。
   * 桌面端（Electron）成功时返回保存路径；移动端（Expo）分享完成后会清理临时文件并返回 null。
   */
  exportToUserDevice(): Promise<string | null>

  /**
   * 物理级全量恢复。
   * 强制切断所有 SQLite 连接锁，抹除所有工作区（Vaults）目录树。
   * 将 ZIP 完全覆盖，重新映射 device_preferences 和 `vault_registry.json` 中属于该终端的绝对路径！
   * 返回合并的还原结果报表。
   */
  importFromZip(zipFilePath: string, createSnapshotBefore?: boolean): Promise<ImportResult>

  /**
   * 在覆盖本地数据前生成保护性快照（仅由 importFromZip / restoreFromSnapshot 内部调用）。
   */
  createSnapshot(options?: { preservePaths?: string[] }): Promise<string | null>

  /** 列出本地快照（按创建时间倒序） */
  listSnapshots(): Promise<SnapshotMeta[]>

  /** 从本地快照恢复（恢复前会自动生成一份新的保护性快照） */
  restoreFromSnapshot(filename: string): Promise<ImportResult>

  /** 删除指定本地快照 */
  deleteSnapshot(filename: string): Promise<void>
}
