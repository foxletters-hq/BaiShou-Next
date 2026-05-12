import type { VersionSnapshot } from '@baishou/shared';

/**
 * 版本管理服务接口
 * 负责本地文件版本备份和回滚
 */
export interface IVersionManager {
  /**
   * 备份指定文件的当前版本
   * @param filePath - 文件相对路径
   * @returns 备份文件路径
   * @throws {VersionBackupError} 备份失败
   */
  backup(filePath: string): Promise<string>;

  /**
   * 批量备份多个文件
   * @param filePaths - 文件路径列表
   * @returns 备份文件路径列表
   */
  backupBatch(filePaths: string[]): Promise<string[]>;

  /**
   * 获取文件的版本历史
   * @param filePath - 文件相对路径
   * @returns 版本列表（按时间倒序）
   */
  getVersions(filePath: string): Promise<VersionSnapshot[]>;

  /**
   * 恢复文件到指定版本
   * @param filePath - 文件相对路径
   * @param versionId - 版本 ID（时间戳）
   * @throws {VersionRestoreError} 恢复失败
   * @throws {VersionNotFoundError} 版本不存在
   */
  restore(filePath: string, versionId: number): Promise<void>;

  /**
   * 清理旧版本，保留最近 N 个
   * @param filePath - 文件路径
   * @param keepCount - 保留数量，默认 10
   */
  cleanup(filePath: string, keepCount?: number): Promise<void>;
}
