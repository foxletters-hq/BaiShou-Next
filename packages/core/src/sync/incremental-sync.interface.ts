import type {
  S3SyncConfig,
  SyncManifest,
  IncrementalSyncResult,
} from '@baishou/shared';

/**
 * S3 增量同步服务接口
 * 负责跨平台文件增量同步
 */
export interface IIncrementalSyncService {
  // ── 配置 ───────────────────────────────────────────────────

  /**
   * 获取当前 S3 同步配置
   */
  getConfig(): Promise<S3SyncConfig>;

  /**
   * 更新 S3 同步配置
   * @throws {S3ConfigError} 配置无效
   */
  updateConfig(config: Partial<S3SyncConfig>): Promise<void>;

  /**
   * 测试 S3 连接
   * @returns 连接是否成功
   */
  testConnection(): Promise<boolean>;

  // ── 同步操作 ───────────────────────────────────────────────

  /**
   * 执行增量同步
   * 1. 下载远端 manifest
   * 2. 比较本地文件 hash
   * 3. 上传/下载差异文件
   * 4. 更新远端 manifest
   *
   * @returns 同步结果
   * @throws {S3SyncError} 同步失败
   * @throws {S3NotConfiguredError} 未配置 S3
   */
  sync(): Promise<IncrementalSyncResult>;

  /**
   * 仅上传变更（不同步下载）
   * 用于移动端快速备份
   */
  uploadOnly(): Promise<IncrementalSyncResult>;

  /**
   * 仅下载变更（不同步上传）
   * 用于移动端恢复数据
   */
  downloadOnly(): Promise<IncrementalSyncResult>;

  // ── 清单管理 ───────────────────────────────────────────────

  /**
   * 获取本地 manifest
   */
  getLocalManifest(): Promise<SyncManifest>;

  /**
   * 获取远端 manifest
   * @throws {S3ConnectionError} 获取失败
   */
  getRemoteManifest(): Promise<SyncManifest>;

  /**
   * 计算本地文件 hash 并更新本地 manifest
   */
  refreshLocalManifest(): Promise<SyncManifest>;

  // ── 冲突处理 ───────────────────────────────────────────────

  /**
   * 获取上次同步的冲突文件列表
   * 冲突文件已通过 Last-Write-Wins 自动处理
   * 旧版本已备份到 .versions/ 目录
   */
  getLastSyncConflicts(): Promise<string[]>;
}
