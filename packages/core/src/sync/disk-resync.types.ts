/** 按活跃工作区限定磁盘全量同步时的清理范围，避免误删其他 vault 的 SQLite 记录 */
export type DiskResyncOptions = {
  activeVaultName?: string
}
