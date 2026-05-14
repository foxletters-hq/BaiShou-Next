import * as fs from 'fs';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { logger } from '@baishou/shared';
import type {
  GitCommit,
  GitSyncConfig,
  GitStatus,
  GitStatusFile,
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
  commitMessageTemplate: 'sync: {date}',
};

const GITIGNORE_CONTENT = `# SQLite 数据库
*.db
*.db-journal
*.db-wal
*.db-shm

# 应用数据目录（由 BaiShou 管理，不作为日记内容版本化）
.baishou/

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

  private currentVaultPath: string | null = null;

  private async ensureGit(): Promise<SimpleGit> {
    const vaultPath = await this.getVaultPath();
    if (!this.git || this.currentVaultPath !== vaultPath) {
      this.git = simpleGit(vaultPath);
      this.currentVaultPath = vaultPath;
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

      // 创建初始 commit，确保仓库有历史记录
      await git.add('.gitignore');
      await git.commit('初始化 Git 版本管理');
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

  async getStatus(): Promise<GitStatus> {
    const git = await this.ensureGit();
    const status = await git.status();

    const staged: GitStatusFile[] = [];
    const unstaged: GitStatusFile[] = [];

    for (const file of status.files) {
      const stagedStatus = this.mapWorkingStatus(file.index);
      const unstagedStatus = this.mapWorkingStatus(file.working_dir);

      // 已暂存的文件（index 不为空）
      if (stagedStatus !== '') {
        staged.push({
          path: file.path,
          stagedStatus,
          unstagedStatus: '',
        });
      }

      // 工作区有修改但未暂存的文件（working_dir 不为空）
      if (unstagedStatus !== '') {
        unstaged.push({
          path: file.path,
          stagedStatus: '',
          unstagedStatus,
        });
      }
    }

    return {
      staged,
      unstaged,
      untracked: status.created,
      conflicted: status.conflicted,
      hasChanges: !status.isClean(),
    };
  }

  private mapWorkingStatus(status: string): FileChange['status'] | '' {
    switch (status.trim()) {
      case 'A':
        return 'added';
      case 'M':
        return 'modified';
      case 'D':
        return 'deleted';
      case 'R':
        return 'renamed';
      case '?':
        return 'added';
      default:
        return '';
    }
  }

  async unstageFile(filePath: string): Promise<void> {
    const git = await this.ensureGit();
    logger.info(`[GitSync] 取消暂存: ${filePath}`);
    await git.reset(['HEAD', '--', filePath]);
  }

  async discardFile(filePath: string): Promise<void> {
    const git = await this.ensureGit();
    logger.info(`[GitSync] 丢弃修改: ${filePath}`);
    await git.checkout(['--', filePath]);
  }

  async discardAllChanges(): Promise<void> {
    const git = await this.ensureGit();
    logger.info('[GitSync] 丢弃全部修改');
    await git.checkout(['--', '.']);
  }

  async getConfig(): Promise<GitSyncConfig> {
    await this.loadConfig();
    return { ...this.config };
  }

  async updateConfig(config: Partial<GitSyncConfig>): Promise<void> {
    const oldRemoteUrl = this.config.remote?.url;
    this.config = { ...this.config, ...config };
    await this.saveConfig();

    // 同步 git remote 配置
    const newRemoteUrl = this.config.remote?.url;
    if (oldRemoteUrl !== newRemoteUrl) {
      try {
        const git = await this.ensureGit();
        const remotes = await git.getRemotes(true);
        const hasOrigin = remotes.some(r => r.name === 'origin');

        if (newRemoteUrl) {
          if (hasOrigin) {
            await git.remote(['set-url', 'origin', newRemoteUrl]);
            logger.info(`[GitSync] 已更新远程仓库: ${newRemoteUrl}`);
          } else {
            await git.remote(['add', 'origin', newRemoteUrl]);
            logger.info(`[GitSync] 已添加远程仓库: ${newRemoteUrl}`);
          }
        } else if (hasOrigin) {
          await git.remote(['remove', 'origin']);
          logger.info('[GitSync] 已移除远程仓库');
        }
      } catch (e) {
        logger.warn(`[GitSync] 远程仓库配置同步失败:`, e as any);
      }
    }
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

      // add 之后取 status，此时暂存区包含新文件 + 变更文件
      const stagedStatus = await git.status();
      const result = await git.commit(message);
      logger.info(`[GitSync] 提交成功: ${result.commit}`);

      return {
        hash: result.commit,
        message,
        date: new Date(),
        files: stagedStatus.files.map((f) => f.path),
      };
    } catch (error) {
      logger.error(`[GitSync] 提交失败: ${error}`);
      throw new GitCommitError(error instanceof Error ? error : undefined);
    }
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
      // 仓库无 commit 时返回空
      return [];
    }
  }

  async getRecentPulls(limit = 10): Promise<VersionHistoryEntry[]> {
    const git = await this.ensureGit();
    try {
      const branch = this.config.remote?.branch || 'main';
      const log = await git.log([`origin/${branch}`, '--max-count', String(limit)]);
      const entries: VersionHistoryEntry[] = [];
      for (const commit of log.all) {
        entries.push({
          commit: {
            hash: commit.hash.substring(0, 7),
            message: commit.message,
            date: new Date(commit.date),
            files: [],
          },
          changes: [],
          isCurrent: false,
        });
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

  async getWorkingDiff(filePath: string, staged: boolean): Promise<FileDiff> {
    const git = await this.ensureGit();
    const args = staged
      ? ['--cached', '--', filePath]
      : ['--', filePath];

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
      let restored = false;
      try {
        await git.raw(['restore', '--source', `${commitHash}~1`, '--', filePath]);
        logger.info(`[GitSync] 回滚成功(已恢复): ${filePath}`);
        restored = true;
      } catch {
        // ~1 不存在: 文件在此 commit 首次添加，应删除
        logger.info(`[GitSync] ${filePath} 在旧版本不存在，执行删除`);
        try {
          if (fs.existsSync(fullPath)) {
            await fs.promises.unlink(fullPath);
            logger.info(`[GitSync] 回滚成功(已删除): ${filePath}`);
            restored = true;
          }
        } catch (unlinkErr) {
          logger.error(`[GitSync] 删除文件失败: ${unlinkErr}`);
        }
      }

      if (!restored) {
        throw new Error(`无法回滚 ${filePath}: 文件在此版本前后均不存在`);
      }

      // 创建回滚 commit 作为撤销点
      await this.commitAll(`回滚文件: ${filePath} ← ${commitHash}`).catch(e => {
        logger.warn(`[GitSync] 回滚自动提交失败:`, e as any);
      });
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

      // 先尝试整体 checkout
      try {
        await git.raw(['checkout', commitHash, '--', '.']);
        logger.info(`[GitSync] 仓库回滚成功: ${commitHash}`);
      } catch (checkoutErr: any) {
        const msg = checkoutErr?.message || '';
        // 如果是因为文件锁定，逐一回滚跳过锁定文件
        if (msg.includes('unable to unlink') || msg.includes('Invalid argument')) {
          logger.warn(`[GitSync] 整体回滚遇到锁定文件，改为逐文件回滚`);
          await this.rollbackAllFileByFile(git, commitHash);
        } else {
          throw checkoutErr;
        }
      }

      // 创建回滚 commit 作为撤销点
      await this.commitAll(`回滚整仓库到: ${commitHash}`).catch(e => {
        logger.warn(`[GitSync] 回滚自动提交失败:`, e as any);
      });
    } catch (error) {
      logger.error(`[GitSync] 仓库回滚失败: ${error}`);
      throw new GitRollbackError(error instanceof Error ? error : undefined);
    }
  }

  /**
   * 逐文件回滚，跳过无法操作的锁定文件
   */
  private async rollbackAllFileByFile(git: SimpleGit, commitHash: string): Promise<void> {
    const diff = await git.diffSummary([`${commitHash}~1`, commitHash]);
    let failCount = 0;

    for (const file of diff.files) {
      try {
        await git.raw(['checkout', commitHash, '--', file.file]);
      } catch {
        failCount++;
        logger.warn(`[GitSync] 跳过无法回滚的文件: ${file.file}`);
      }
    }

    logger.info(`[GitSync] 逐文件回滚完成，跳过 ${failCount} 个锁定文件`);
  }

  private async ensureRemote(): Promise<void> {
    const url = this.config.remote?.url;
    if (!url) throw new GitRemoteNotConfiguredError();

    const git = await this.ensureGit();
    const remotes = await git.getRemotes(true);
    const origin = remotes.find(r => r.name === 'origin');

    if (!origin) {
      await git.remote(['add', 'origin', url]);
      logger.info(`[GitSync] 自动添加远程仓库: ${url}`);
    } else if (origin.refs.fetch !== url && origin.refs.push !== url) {
      await git.remote(['set-url', 'origin', url]);
      logger.info(`[GitSync] 自动更新远程仓库: ${url}`);
    }
  }

  async push(): Promise<void> {
    await this.ensureRemote();

    try {
      const git = await this.ensureGit();
      const branch = this.config.remote!.branch || 'main';
      logger.info(`[GitSync] 推送至远程: origin/${branch}`);
      await git.push('origin', branch);
      logger.info('[GitSync] 推送成功');
    } catch (error) {
      logger.error(`[GitSync] 推送失败: ${error}`);
      throw new GitPushError(error instanceof Error ? error : undefined);
    }
  }

  async pull(): Promise<void> {
    await this.ensureRemote();

    try {
      const git = await this.ensureGit();
      const branch = this.config.remote!.branch || 'main';
      logger.info(`[GitSync] 从远程拉取: origin/${branch}`);
      await git.pull('origin', branch);
      logger.info('[GitSync] 拉取成功');
    } catch (error) {
      logger.error(`[GitSync] 拉取失败: ${error}`);
      // 检查是否是冲突
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
