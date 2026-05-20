import type {
  S3SyncConfig,
  SyncManifest,
  IncrementalSyncResult,
  SyncProgressCallback,
} from '@baishou/shared';

/**
 * S3 增量同步服务接口 (V2)
 *
 * 采用三向合并算法实现逐文件增量同步：
 * - 共同祖先 = 上次同步时保存的远程 manifest 快照 (last-remote-manifest.json)
 * - 本地版本 = 当前文件系统扫描结果
 * - 远程版本 = 刚从 S3 下载的 manifest
 *
 * 不依赖 tombstone，通过三向对比完整追踪新增/修改/删除。
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
   * 执行三向合并增量同步
   *
   * 流程：
   * 1. 构建本地 manifest（扫描 vault 所有文件）
   * 2. 下载远程 manifest（从 S3）
   * 3. 加载共同祖先（last-remote-manifest.json）
   * 4. 三向合并决策
   * 5. 执行文件操作（上传/下载/删除）
   * 6. 全部成功后更新远程 manifest
   * 7. 保存本地 manifest + 更新远程快照
   *
   * @returns 同步结果（含会话 ID 用于关联操作日志）
   * @throws {S3NotConfiguredError} 未配置 S3
   * @throws {S3ConnectionError} S3 连接失败
   * @throws {S3SyncError} 同步过程中发生不可恢复错误
   * @throws {ManifestFetchError} 获取远程 manifest 失败
   * @param onProgress - 可选的进度回调，逐文件处理时触发
   */
  sync(onProgress?: SyncProgressCallback): Promise<IncrementalSyncResult>;

  /**
   * 仅上传变更（不同步下载）
   * 用于移动端快速备份
   * @param onProgress - 可选的进度回调
   */
  uploadOnly(onProgress?: SyncProgressCallback): Promise<IncrementalSyncResult>;

  /**
   * 仅下载变更（不同步上传）
   * 用于移动端恢复数据
   * @param onProgress - 可选的进度回调
   */
  downloadOnly(onProgress?: SyncProgressCallback): Promise<IncrementalSyncResult>;

  // ── 清单管理 ───────────────────────────────────────────────

  /**
   * 构建本地 manifest（扫描 vault 当前文件状态）
   */
  buildLocalManifest(): Promise<SyncManifest>;

  /**
   * 获取本地已保存的 manifest
   */
  getLocalManifest(): Promise<SyncManifest>;

  /**
   * 获取远程 manifest（从 S3 下载）
   * @throws {S3ConnectionError} 获取失败
   * @throws {ManifestFetchError} manifest 不存在或损坏
   */
  getRemoteManifest(): Promise<SyncManifest>;

  /**
   * 获取远程快照（三向合并的共同祖先）
   * 首次同步时返回空 manifest (version=2, files={})
   */
  getRemoteSnapshot(): Promise<SyncManifest>;

  // ── 冲突处理 ───────────────────────────────────────────────

  /**
   * 获取上次同步的冲突文件列表
   * 冲突文件已通过 mtime 策略自动处理
   * 旧版本：桌面端备份到 .versions/，移动端创建 .conflict-*.md
   */
  getLastSyncConflicts(): Promise<string[]>;
}
