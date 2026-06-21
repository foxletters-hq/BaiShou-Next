import type {
  GitCommit,
  GitRollbackAllContext,
  GitSyncConfig,
  GitStatus,
  FileChange,
  FileDiff,
  VersionHistoryEntry
} from '@baishou/shared'

/**
 * Git 同步服务接口
 * 负责本地 Git 版本管理和远程仓库同步
 */
export interface IGitSyncService {
  // ── 初始化 ─────────────────────────────────────────────────

  /**
   * 初始化 Git 仓库（如果尚未初始化）
   * 在存储根目录执行 git init，管理其下全部工作区（Vault）
   * @throws {GitInitError} 初始化失败
   */
  init(): Promise<void>

  /**
   * 检查 Git 仓库是否已初始化
   */
  isInitialized(): Promise<boolean>

  // ── 配置 ───────────────────────────────────────────────────

  /**
   * 获取当前 Git 同步配置
   */
  getConfig(): Promise<GitSyncConfig>

  /**
   * 更新 Git 同步配置
   * @throws {GitConfigError} 配置无效
   */
  updateConfig(config: Partial<GitSyncConfig>): Promise<void>

  /**
   * 测试远程仓库连接
   * @returns 连接是否成功
   */
  testRemoteConnection(): Promise<boolean>

  // ── 工作区状态 ─────────────────────────────────────────────

  /**
   * 获取当前工作区状态（暂存区 + 工作区变更）
   */
  getStatus(): Promise<GitStatus>

  /**
   * 暂存指定文件（git add）
   */
  stageFile(filePath: string): Promise<void>

  /**
   * 暂存全部文件（git add .）
   */
  stageAll(): Promise<void>

  /**
   * 取消暂存指定文件（从暂存区移回工作区）
   */
  unstageFile(filePath: string): Promise<void>

  /**
   * 取消暂存全部文件
   */
  unstageAll(): Promise<void>

  /**
   * 丢弃指定文件的工作区修改（恢复到暂存区状态或 HEAD）
   */
  discardFile(filePath: string): Promise<void>

  /**
   * 丢弃所有工作区修改（含已跟踪文件变更和未跟踪文件）
   */
  discardAllChanges(): Promise<void>

  // ── 提交操作 ───────────────────────────────────────────────

  /**
   * 提交所有变更（含自动暂存未暂存文件，供同步编排器等内部场景使用）
   */
  commitAll(message: string): Promise<GitCommit | null>

  /**
   * 仅提交已暂存文件，不自动 git add
   */
  commitStaged(message: string): Promise<GitCommit | null>

  /**
   * 提交指定文件的变更
   * @param files - 要提交的文件路径列表
   * @param message - 提交消息
   * @returns 创建的 commit
   * @throws {GitCommitError} 提交失败
   */
  commit(files: string[], message: string): Promise<GitCommit>

  // ── 版本历史 ───────────────────────────────────────────────

  /**
   * 获取指定文件的版本历史
   * @param filePath - 文件相对路径（可选，不传则获取全局历史）
   * @param limit - 返回数量限制，默认 20
   * @param offset - 偏移量，默认 0
   * @returns 版本历史列表（按时间倒序）
   */
  getHistory(filePath?: string, limit?: number, offset?: number): Promise<VersionHistoryEntry[]>

  /**
   * 获取最近拉取的提交记录（来自远程分支）
   * @param limit - 返回数量限制，默认 10
   */
  getRecentPulls(limit?: number): Promise<VersionHistoryEntry[]>

  /**
   * 获取指定 commit 的文件变更列表
   * @param commitHash - commit hash
   */
  getCommitChanges(commitHash: string): Promise<FileChange[]>

  /**
   * 获取文件的 diff
   * @param filePath - 文件路径
   * @param commitHash - commit hash（可选，默认与上一版本比较）
   * @returns diff 详情
   */
  getFileDiff(filePath: string, commitHash?: string): Promise<FileDiff>

  /**
   * 获取工作区文件的 diff（暂存区 vs HEAD 或 工作区 vs 暂存区）
   * @param filePath - 文件路径
   * @param staged - true 表示暂存区 vs HEAD，false 表示工作区 vs 暂存区
   */
  getWorkingDiff(filePath: string, staged: boolean): Promise<FileDiff>

  // ── 回滚操作 ───────────────────────────────────────────────

  /**
   * 回滚指定文件：撤销某次提交对该文件的改动，结果保留在工作区（不自动提交）
   * @param filePath - 文件路径
   * @param commitHash - 要撤销其改动的提交 hash
   * @throws {GitRollbackError} 回滚失败
   */
  rollbackFile(filePath: string, commitHash: string): Promise<void>

  /**
   * 回滚整个仓库到指定提交：mixed reset，后续提交保留为未暂存工作区变更
   * @param commitHash - 目标 commit hash
   * @throws {GitRollbackError} 回滚失败
   */
  rollbackAll(commitHash: string): Promise<void>

  /**
   * 获取整库回滚前的上下文（远程配置、脏工作区、将被移出历史的提交数）
   */
  getRollbackAllContext(targetCommitHash: string): Promise<GitRollbackAllContext>

  // ── 远程同步 ───────────────────────────────────────────────

  /**
   * 推送到远程仓库
   * @throws {GitPushError} 推送失败
   * @throws {GitRemoteNotConfiguredError} 未配置远程仓库
   */
  push(): Promise<void>

  /**
   * 从远程仓库拉取
   * @throws {GitPullError} 拉取失败（含冲突）
   * @throws {GitRemoteNotConfiguredError} 未配置远程仓库
   */
  pull(): Promise<void>

  /**
   * 检查是否有未解决的冲突
   */
  hasConflicts(): Promise<boolean>

  /**
   * 获取冲突文件列表
   */
  getConflicts(): Promise<string[]>

  /**
   * 解决冲突（采用指定版本）
   * @param filePath - 文件路径
   * @param resolution - 'ours' | 'theirs'
   */
  resolveConflict(filePath: string, resolution: 'ours' | 'theirs'): Promise<void>
}
