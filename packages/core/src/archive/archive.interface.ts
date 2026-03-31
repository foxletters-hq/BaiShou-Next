export interface ImportResult {
  fileCount: number;
  profileRestored: boolean;
  snapshotPath?: string;
}

export interface IArchiveService {
  /**
   * 导出为临时 ZIP 文件。内部需要主动过滤 `-wal`, `-shm`，并且热注入 `config/device_preferences.json`。
   * 返回生成的 ZIP 文件的绝对路径（在临时目录中）
   */
  exportToTempFile(): Promise<string | null>;

  /**
   * 导出为本地 ZIP 文件。
   * 桌面端（Electron）直接呼出 dialog.showSaveDialog，移动端（Expo）呼出 Sharing
   * 成功返回物理路径否则返回 null
   */
  exportToUserDevice(): Promise<string | null>;

  /**
   * 物理级全量恢复。
   * 强制切断所有 SQLite 连接锁，抹除所有工作区（Vaults）目录树。
   * 将 ZIP 完全覆盖，重新映射 device_preferences 和 `vault_registry.json` 中属于该终端的绝对路径！
   * 返回合并的还原结果报表。
   */
  importFromZip(zipFilePath: string, createSnapshotBefore?: boolean): Promise<ImportResult>;

  /**
   * 系统主动生成隐式快照供后悔药回滚。
   */
  createSnapshot(): Promise<string | null>;
}
