import type {
  GitCommit,
  GitSyncConfig,
  FileChange,
  FileDiff,
  VersionHistoryEntry,
} from '@baishou/shared';

/**
 * Git 同步服务接口
 * 负责本地 Git 版本管理和远程仓库同步
 */
export interface IGitSyncService {
  // ── 初始化 ─────────────────────────────────────────────────

  /**
   * 初始化 Git 仓库（如果尚未初始化）
   * 在 Vault 根目录执行 git init
   * @throws {GitInitError} 初始化失败
   */
  init(): Promise<void>;

  /**
   * 检查 Git 仓库是否已初始化
   */
  isInitialized(): Promise<boolean>;

  // ── 配置 ───────────────────────────────────────────────────

  /**
   * 获取当前 Git 同步配置
   */
  getConfig(): Promise<GitSyncConfig>;

  /**
   * 更新 Git 同步配置
   * @throws {GitConfigError} 配置无效
   */
  updateConfig(config: Partial<GitSyncConfig>): Promise<void>;

  /**
   * 测试远程仓库连接
   * @returns 连接是否成功
   */
  testRemoteConnection(): Promise<boolean>;

  // ── 提交操作 ───────────────────────────────────────────────

  /**
   * 自动提交所有变更
   * 使用配置中的 commitMessageTemplate 生成消息
   * @returns 创建的 commit，无变更时返回 null
   */
  autoCommit(): Promise<GitCommit | null>;

  /**
   * 提交所有变更（手动提交）
   * @param message - 提交消息
   * @returns 创建的 commit
   * @throws {GitCommitError} 提交失败
   */
  commitAll(message: string): Promise<GitCommit | null>;

  /**
   * 提交指定文件的变更
   * @param files - 要提交的文件路径列表
   * @param message - 提交消息
   * @returns 创建的 commit
   * @throws {GitCommitError} 提交失败
   */
  commit(files: string[], message: string): Promise<GitCommit>;

  // ── 版本历史 ───────────────────────────────────────────────

  /**
   * 获取指定文件的版本历史
   * @param filePath - 文件相对路径（可选，不传则获取全局历史）
   * @param limit - 返回数量限制，默认 20
   * @param offset - 偏移量，默认 0
   * @returns 版本历史列表（按时间倒序）
   */
  getHistory(filePath?: string, limit?: number, offset?: number): Promise<VersionHistoryEntry[]>;

  /**
   * 获取指定 commit 的文件变更列表
   * @param commitHash - commit hash
   */
  getCommitChanges(commitHash: string): Promise<FileChange[]>;

  /**
   * 获取文件的 diff
   * @param filePath - 文件路径
   * @param commitHash - commit hash（可选，默认与上一版本比较）
   * @returns diff 详情
   */
  getFileDiff(filePath: string, commitHash?: string): Promise<FileDiff>;

  // ── 回滚操作 ───────────────────────────────────────────────

  /**
   * 回滚指定文件到指定版本
   * @param filePath - 文件路径
   * @param commitHash - 目标 commit hash
   * @throws {GitRollbackError} 回滚失败
   */
  rollbackFile(filePath: string, commitHash: string): Promise<void>;

  // ── 远程同步 ───────────────────────────────────────────────

  /**
   * 推送到远程仓库
   * @throws {GitPushError} 推送失败
   * @throws {GitRemoteNotConfiguredError} 未配置远程仓库
   */
  push(): Promise<void>;

  /**
   * 从远程仓库拉取
   * @throws {GitPullError} 拉取失败（含冲突）
   * @throws {GitRemoteNotConfiguredError} 未配置远程仓库
   */
  pull(): Promise<void>;

  /**
   * 检查是否有未解决的冲突
   */
  hasConflicts(): Promise<boolean>;

  /**
   * 获取冲突文件列表
   */
  getConflicts(): Promise<string[]>;

  /**
   * 解决冲突（采用指定版本）
   * @param filePath - 文件路径
   * @param resolution - 'ours' | 'theirs'
   */
  resolveConflict(filePath: string, resolution: 'ours' | 'theirs'): Promise<void>;
}
