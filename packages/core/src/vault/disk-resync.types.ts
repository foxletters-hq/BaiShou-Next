/** 按活跃工作区限定磁盘全量同步时的清理范围，避免误删其他 vault 的 SQLite 记录 */
export type DiskResyncOptions = {
  activeVaultName?: string
  /** 跳过超过此大小的 session JSON 读入（字节），防止移动端 OOM */
  maxSessionJsonReadBytes?: number
}
