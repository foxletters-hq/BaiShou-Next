/** 按活跃工作区限定磁盘全量同步时的清理范围，避免误删其他 vault 的 SQLite 记录 */
export type DiskResyncOptions = {
  activeVaultName?: string
  /** 跳过超过此大小的 session JSON 读入（字节），防止移动端 OOM */
  maxSessionJsonReadBytes?: number
  /**
   * 尚未落盘（或 flush 失败）的会话 ID：fullScan 不得当幽灵从 SQLite 删除。
   * 避免 vault/存储根切换窗口内「库有盘无」被误清。
   */
  preserveSessionIds?: ReadonlySet<string> | readonly string[]
}
