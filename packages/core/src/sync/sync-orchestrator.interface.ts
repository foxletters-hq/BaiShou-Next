import type { IncrementalSyncResult, SyncSessionLog, S3SyncConfig } from '@baishou/shared';

/**
 * 同步编排器接口
 *
 * 协调完整的同步流程：
 * - 桌面端：git commit → 三向合并同步 → 操作日志
 * - 移动端：三向合并同步 → 操作日志
 *
 * 编排器负责流程编排，具体同步逻辑委托给 IIncrementalSyncService，
 * 操作日志委托给 IOperationLogService。
 */
export interface ISyncOrchestrator {
  /**
   * 执行完整的一键同步流程
   *
   * 桌面端：先执行 git commit，失败不阻塞同步
   * 移动端：直接执行 S3 同步
   *
   * @returns 同步结果
   * @throws {S3NotConfiguredError} 未配置 S3
   * @throws {S3ConfigError} S3 配置无效
   * @throws {S3ConnectionError} S3 连接失败
   * @throws {S3SyncError} 同步操作失败
   * @throws {SyncInProgressError} 已有同步正在进行
   *
   * @example
   * ```ts
   * const result = await orchestrator.sync();
   * if (result.conflicted.length > 0) {
   *   console.log('冲突已自动处理:', result.conflicted);
   * }
   * ```
   */
  sync(): Promise<IncrementalSyncResult>;

  /**
   * 仅上传变更（不同步下载）
   */
  uploadOnly(): Promise<IncrementalSyncResult>;

  /**
   * 仅下载变更（不同步上传）
   */
  downloadOnly(): Promise<IncrementalSyncResult>;

  /**
   * 获取同步历史记录
   *
   * @param limit - 最大返回条数，默认 20
   * @returns 按时间倒序排列
   */
  getSyncHistory(limit?: number): Promise<SyncSessionLog[]>;

  /**
   * 测试 S3 连接
   */
  testConnection(): Promise<boolean>;

  /**
   * 获取 S3 配置
   */
  getConfig(): Promise<S3SyncConfig>;

  /**
   * 更新 S3 配置
   * @throws {S3ConfigError} 配置无效
   */
  updateConfig(config: Partial<S3SyncConfig>): Promise<void>;
}
