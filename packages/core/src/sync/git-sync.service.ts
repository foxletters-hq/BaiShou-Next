import * as fs from 'fs';
import * as path from 'path';
import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import { logger } from '@baishou/shared';
import type {
  GitCommit,
  GitSyncConfig,
  FileChange,
  FileDiff,
  VersionHistoryEntry,
} from '@baishou/shared';
import type { IGitSyncService } from './git-sync.interface';
import {
  GitInitError,
  GitCommitError,
  GitPushError,
  GitPullError,
  GitRemoteNotConfiguredError,
  GitRollbackError,
} from './sync.errors';
import type { IStoragePathService } from '../vault/storage-path.types';

const DEFAULT_CONFIG: GitSyncConfig = {
  enabled: false,
  autoCommit: true,
  commitMessageTemplate: 'sync: {date}',
};

const GITIGNORE_CONTENT = `# SQLite 数据库
*.db
*.db-journal
*.db-wal

# 版本备份（由 Git 本身管理历史）
.versions/

# 临时文件
*.tmp
.DS_Store
Thumbs.db
`;

export class GitSyncServiceImpl implements IGitSyncService {
  private git: SimpleGit | null = null;
  private config: GitSyncConfig = { ...DEFAULT_CONFIG };
  private readonly configFileName = '.baishou-git.json';

  constructor(private readonly pathService: IStoragePathService) {}

  // ── 内部辅助 ───────────────────────────────────────────────

  private async getVaultPath(): Promise<string> {
    const vaultPath = await this.pathService.getActiveVaultPath();
    if (!vaultPath) {
      throw new GitInitError(new Error('No active vault found'));
    }
    return vaultPath;
  }

  private async ensureGit(): Promise<SimpleGit> {
    if (!this.git) {
      const vaultPath = await this.getVaultPath();
      this.git = simpleGit(vaultPath);
    }
    return this.git;
  }

  private async loadConfig(): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const configPath = path.join(vaultPath, this.configFileName);

    if (fs.existsSync(configPath)) {
      try {
        const raw = await fs.promises.readFile(configPath, 'utf8');
        const saved = JSON.parse(raw) as Partial<GitSyncConfig>;
        this.config = { ...DEFAULT_CONFIG, ...saved };
      } catch {
        this.config = { ...DEFAULT_CONFIG };
      }
    }
  }

  private async saveConfig(): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const configPath = path.join(vaultPath, this.configFileName);

    await fs.promises.writeFile(
      configPath,
      JSON.stringify(this.config, null, 2),
      'utf8'
    );
  }

  private async ensureGitignore(): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const gitignorePath = path.join(vaultPath, '.gitignore');

    if (!fs.existsSync(gitignorePath)) {
      await fs.promises.writeFile(gitignorePath, GITIGNORE_CONTENT, 'utf8');
    }
  }

  private formatDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  private parseCommitMessage(template: string): string {
    return template.replace('{date}', this.formatDate());
  }

  private mapStatusToType(status: string): FileChange['status'] {
    switch (status) {
      case 'A':
        return 'added';
      case 'D':
        return 'deleted';
      case 'R':
        return 'renamed';
      default:
        return 'modified';
    }
  }

  // ── 公开 API ───────────────────────────────────────────────

  async init(): Promise<void> {
    try {
      const vaultPath = await this.getVaultPath();
      logger.info(`[GitSync] 正在初始化 Git 仓库: ${vaultPath}`);
      const git = await this.ensureGit();
      await git.init();
      await this.ensureGitignore();
      await this.loadConfig();
      logger.info(`[GitSync] Git 仓库初始化成功: ${vaultPath}`);
    } catch (error) {
      logger.error(`[GitSync] Git 仓库初始化失败: ${error}`);
      throw new GitInitError(error instanceof Error ? error : undefined);
    }
  }

  async isInitialized(): Promise<boolean> {
    try {
      const vaultPath = await this.getVaultPath();
      return fs.existsSync(path.join(vaultPath, '.git'));
    } catch {
      return false;
    }
  }

  async getConfig(): Promise<GitSyncConfig> {
    await this.loadConfig();
    return { ...this.config };
  }

  async updateConfig(config: Partial<GitSyncConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.saveConfig();
  }

  async testRemoteConnection(): Promise<boolean> {
    if (!this.config.remote?.url) {
      return false;
    }

    try {
      const git = await this.ensureGit();
      await git.listRemote([this.config.remote.url]);
      return true;
    } catch {
      return false;
    }
  }

  async commitAll(message: string): Promise<GitCommit | null> {
    const git = await this.ensureGit();
    logger.info(`[GitSync] 手动提交: ${message}`);

    const status = await git.status();
    if (status.isClean()) {
      logger.info('[GitSync] 无变更，跳过提交');
      return null;
    }

    try {
      logger.info(`[GitSync] 暂存 ${status.files.length} 个文件`);
      await git.add('.');
      const result = await git.commit(message);
      logger.info(`[GitSync] 提交成功: ${result.commit}`);

      return {
        hash: result.commit,
        message,
        date: new Date(),
        files: status.files.map((f) => f.path),
      };
    } catch (error) {
      logger.error(`[GitSync] 提交失败: ${error}`);
      throw new GitCommitError(error instanceof Error ? error : undefined);
    }
  }

  async autoCommit(): Promise<GitCommit | null> {
    const git = await this.ensureGit();
    const status: StatusResult = await git.status();

    if (status.isClean()) {
      return null;
    }

    const message = this.parseCommitMessage(this.config.commitMessageTemplate);
    await git.add('.');
    const result = await git.commit(message);

    return {
      hash: result.commit,
      message,
      date: new Date(),
      files: status.files.map((f) => f.path),
    };
  }

  async commit(files: string[], message: string): Promise<GitCommit> {
    try {
      const git = await this.ensureGit();
      await git.add(files);
      const result = await git.commit(message);

      return {
        hash: result.commit,
        message,
        date: new Date(),
        files,
      };
    } catch (error) {
      throw new GitCommitError(error instanceof Error ? error : undefined);
    }
  }

  async getHistory(filePath?: string, limit = 20, offset = 0): Promise<VersionHistoryEntry[]> {
    const git = await this.ensureGit();

    const options = ['--max-count', String(limit)];
    if (offset > 0) {
      options.push('--skip', String(offset));
    }
    if (filePath) {
      options.push('--', filePath);
    }

    try {
      const log = await git.log(options);
      const entries: VersionHistoryEntry[] = [];
      for (const commit of log.all) {
        try {
          const changes = await this.getCommitChanges(commit.hash);
          entries.push({
            commit: {
              hash: commit.hash.substring(0, 7),
              message: commit.message,
              date: new Date(commit.date),
              files: changes.map((c) => c.path),
            },
            changes,
            isCurrent: offset === 0 && entries.length === 0,
          });
        } catch {
          entries.push({
            commit: {
              hash: commit.hash.substring(0, 7),
              message: commit.message,
              date: new Date(commit.date),
              files: [],
            },
            changes: [],
            isCurrent: offset === 0 && entries.length === 0,
          });
        }
      }
      return entries;
    } catch {
      return [];
    }
  }

  async getCommitChanges(commitHash: string): Promise<FileChange[]> {
    const git = await this.ensureGit();
    try {
      const diff = await git.diffSummary([`${commitHash}~1`, commitHash]);

      return diff.files.map((file) => ({
        path: file.file,
        status: this.mapStatusToType((file as { status?: string }).status ?? 'M'),
        additions: 'insertions' in file ? file.insertions : 0,
        deletions: 'deletions' in file ? file.deletions : 0,
      }));
    } catch {
      // 首次提交无父节点时，尝试不带 ~1
      try {
        const diff = await git.diffSummary([commitHash]);
        return diff.files.map((file) => ({
          path: file.file,
          status: 'added' as FileChange['status'],
          additions: 'insertions' in file ? file.insertions : 0,
          deletions: 'deletions' in file ? file.deletions : 0,
        }));
      } catch {
        return [];
      }
    }
  }

  async getFileDiff(filePath: string, commitHash?: string): Promise<FileDiff> {
    const git = await this.ensureGit();

    const args = commitHash
      ? [`${commitHash}~1`, commitHash, '--', filePath]
      : ['HEAD~1', 'HEAD', '--', filePath];

    try {
      const diff = await git.diff(args);
      return { path: filePath, hunks: this.parseDiffHunks(diff) };
    } catch {
      return { path: filePath, hunks: [] };
    }
  }

  private parseDiffHunks(diff: string): FileDiff['hunks'] {
    const hunks: FileDiff['hunks'] = [];
    const hunkRegex = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@(.*)$/gm;
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = hunkRegex.exec(diff)) !== null) {
      if (hunks.length > 0) {
        hunks[hunks.length - 1]!.content = diff.substring(lastIndex, match.index);
      }

      hunks.push({
        oldStart: parseInt(match[1]!, 10),
        oldLines: match[2] ? parseInt(match[2], 10) : 1,
        newStart: parseInt(match[3]!, 10),
        newLines: match[4] ? parseInt(match[4], 10) : 1,
        content: '',
      });

      lastIndex = match.index + match[0].length;
    }

    if (hunks.length > 0) {
      hunks[hunks.length - 1]!.content = diff.substring(lastIndex);
    }

    return hunks;
  }

  async rollbackFile(filePath: string, commitHash: string): Promise<void> {
    try {
      const git = await this.ensureGit();
      const vaultPath = await this.getVaultPath();
      const fullPath = path.join(vaultPath, filePath);
      logger.info(`[GitSync] 回滚文件: ${filePath} <- ${commitHash}~1`);

      // 回滚到变更前版本 (commitHash~1 = 该 commit 的上一个版本)
      try {
        await git.raw(['restore', '--source', `${commitHash}~1`, '--', filePath]);
        logger.info(`[GitSync] 回滚成功(已恢复): ${filePath}`);
        return;
      } catch {
        // ~1 不存在: 文件在此 commit 首次添加，应删除
        logger.info(`[GitSync] ${filePath} 在旧版本不存在，执行删除`);
        try {
          if (fs.existsSync(fullPath)) {
            await fs.promises.unlink(fullPath);
            logger.info(`[GitSync] 回滚成功(已删除): ${filePath}`);
            return;
          }
        } catch (unlinkErr) {
          logger.error(`[GitSync] 删除文件失败: ${unlinkErr}`);
        }
      }

      throw new Error(`无法回滚 ${filePath}: 文件在此版本前后均不存在`);
    } catch (error) {
      logger.error(`[GitSync] 回滚失败 ${filePath}: ${error}`);
      throw new GitRollbackError(error instanceof Error ? error : undefined);
    }
  }

  /**
   * 回滚整个仓库到指定 commit 的状态（仅更新工作区，不动 HEAD）
   */
  async rollbackAll(commitHash: string): Promise<void> {
    try {
      const git = await this.ensureGit();
      logger.info(`[GitSync] 回滚仓库: ${commitHash}`);
      await git.raw(['checkout', commitHash, '--', '.']);
      logger.info(`[GitSync] 仓库回滚成功: ${commitHash}`);
    } catch (error) {
      logger.error(`[GitSync] 仓库回滚失败: ${error}`);
      throw new GitRollbackError(error instanceof Error ? error : undefined);
    }
  }

  async push(): Promise<void> {
    if (!this.config.remote?.url) {
      throw new GitRemoteNotConfiguredError();
    }

    try {
      const git = await this.ensureGit();
      const branch = this.config.remote.branch || 'main';
      logger.info(`[GitSync] 推送至远程: origin/${branch}`);
      await git.push('origin', branch);
      logger.info('[GitSync] 推送成功');
    } catch (error) {
      logger.error(`[GitSync] 推送失败: ${error}`);
      throw new GitPushError(error instanceof Error ? error : undefined);
    }
  }

  async pull(): Promise<void> {
    if (!this.config.remote?.url) {
      throw new GitRemoteNotConfiguredError();
    }

    try {
      const git = await this.ensureGit();
      const branch = this.config.remote.branch || 'main';
      logger.info(`[GitSync] 从远程拉取: origin/${branch}`);
      await git.pull('origin', branch);
      logger.info('[GitSync] 拉取成功');
    } catch (error) {
      logger.error(`[GitSync] 拉取失败: ${error}`);
      const conflicts = await this.getConflicts();
      if (conflicts.length > 0) {
        throw new GitPullError(conflicts, error instanceof Error ? error : undefined);
      }
      throw new GitPullError(undefined, error instanceof Error ? error : undefined);
    }
  }

  async hasConflicts(): Promise<boolean> {
    const conflicts = await this.getConflicts();
    return conflicts.length > 0;
  }

  async getConflicts(): Promise<string[]> {
    try {
      const git = await this.ensureGit();
      const status = await git.status();
      return status.conflicted;
    } catch {
      return [];
    }
  }

  async resolveConflict(filePath: string, resolution: 'ours' | 'theirs'): Promise<void> {
    try {
      const git = await this.ensureGit();
      await git.raw(['checkout', `--${resolution}`, filePath]);
      await git.add(filePath);
    } catch (error) {
      throw new GitRollbackError(error instanceof Error ? error : undefined);
    }
  }
}
