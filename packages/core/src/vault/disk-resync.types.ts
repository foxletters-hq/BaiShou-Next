/** 按活跃工作区限定磁盘全量同步时的清理范围，避免误删其他 vault 的 SQLite 记录 */
export type DiskResyncOptions = {
  activeVaultName?: string
  /**
   * 要扫描的工作区 Sessions/ 目录名。传入时跨 vault 水合会话 JSON；
   * 省略时仅扫当前活跃 vault（兼容旧行为）。
   */
  diskVaultNames?: string[]
  /** 跳过超过此大小的 session JSON 读入（字节），防止移动端 OOM */
  maxSessionJsonReadBytes?: number
  /**
   * 尚未落盘（或 flush 失败）的会话 ID：fullScan 不得当幽灵从 SQLite 删除。
   * 避免 vault/存储根切换窗口内「库有盘无」被误清。
   */
  preserveSessionIds?: ReadonlySet<string> | readonly string[]
  /**
   * 冷启动 reconcile：盘 mtime 未新于 DB 记录时间时跳过读文件内容。
   * 仅 Summary 等支持该选项的层使用。
   */
  skipUnchangedByMtime?: boolean
}
