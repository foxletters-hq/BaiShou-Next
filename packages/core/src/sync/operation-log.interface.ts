import type { SyncSessionLog, SyncSummary } from '@baishou/shared'

/**
 * 同步操作日志服务接口
 *
 * 负责持久化每次同步会话的操作记录。
 * 存储位置: <vault>/.baishou/sync-log/<sessionId>.json
 * 清理策略: 最多保留 50 条，写入新日志时自动删除最旧。
 */
export interface IOperationLogService {
  /**
   * 写入一次同步会话日志
   *
   * @param log - 完整的会话日志
   * @throws {SyncLogError} 写入失败
   */
  writeLog(log: SyncSessionLog): Promise<void>

  /**
   * 获取最近的同步日志列表
   *
   * @param limit - 最大返回条数，默认 20
   * @returns 按时间倒序排列的日志列表
   */
  getRecentLogs(limit?: number): Promise<SyncSessionLog[]>

  /**
   * 获取最近一次同步的摘要
   *
   * @returns 摘要信息；无日志时返回 null
   */
  getLastSyncSummary(): Promise<SyncSummary | null>

  /**
   * 获取日志总条数
   */
  getLogCount(): Promise<number>

  /**
   * 清理旧日志，保留最近 keepCount 条。
   * 通常在写入新日志后自动调用。
   *
   * @param keepCount - 保留条数，默认 50
   */
  cleanupOldLogs(keepCount?: number): Promise<void>
}
