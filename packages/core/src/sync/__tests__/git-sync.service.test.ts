import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IGitSyncService } from '../git-sync.interface';
import type { GitCommit, GitSyncConfig, VersionHistoryEntry } from '@baishou/shared';
import {
  GitInitError,
  GitCommitError,
  GitPushError,
  GitPullError,
  GitRemoteNotConfiguredError,
  GitRollbackError,
} from '../sync.errors';

describe('GitSyncService', () => {
  let service: IGitSyncService;

  beforeEach(() => {
    // Mock 实现将在实现阶段替换
    service = {
      init: vi.fn(),
      isInitialized: vi.fn(),
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      testRemoteConnection: vi.fn(),
      commit: vi.fn(),
      commitAll: vi.fn(),
      getHistory: vi.fn(),
      getCommitChanges: vi.fn(),
      getFileDiff: vi.fn(),
      rollbackFile: vi.fn(),
      rollbackAll: vi.fn(),
      push: vi.fn(),
      pull: vi.fn(),
      hasConflicts: vi.fn(),
      getConflicts: vi.fn(),
      resolveConflict: vi.fn(),
    } satisfies IGitSyncService;
  });

  describe('init', () => {
    it('should initialize git repository successfully', async () => {
      vi.mocked(service.init).mockResolvedValue(undefined);

      await expect(service.init()).resolves.toBeUndefined();
      expect(service.init).toHaveBeenCalledOnce();
    });

    it('should throw GitInitError when initialization fails', async () => {
      const cause = new Error('git init failed');
      vi.mocked(service.init).mockRejectedValue(new GitInitError(cause));

      await expect(service.init()).rejects.toThrow(GitInitError);
    });
  });

  describe('isInitialized', () => {
    it('should return true when repository exists', async () => {
      vi.mocked(service.isInitialized).mockResolvedValue(true);

      const result = await service.isInitialized();
      expect(result).toBe(true);
    });

    it('should return false when repository does not exist', async () => {
      vi.mocked(service.isInitialized).mockResolvedValue(false);

      const result = await service.isInitialized();
      expect(result).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return current git sync config', async () => {
      const config: GitSyncConfig = {
        enabled: true,
        commitMessageTemplate: 'sync: {date}',
      };
      vi.mocked(service.getConfig).mockResolvedValue(config);

      const result = await service.getConfig();
      expect(result).toEqual(config);
    });
  });

  describe('updateConfig', () => {
    it('should update config with partial values', async () => {
      vi.mocked(service.updateConfig).mockResolvedValue(undefined);

      await expect(service.updateConfig({ enabled: true })).resolves.toBeUndefined();
      expect(service.updateConfig).toHaveBeenCalledWith({ enabled: true });
    });
  });

  describe('commit', () => {
    it('should commit specified files with message', async () => {
      const commit: GitCommit = {
        hash: 'def5678',
        message: '更新日记',
        date: new Date(),
        files: ['Journals/2026/05/2026-05-13.md'],
      };
      vi.mocked(service.commit).mockResolvedValue(commit);

      const result = await service.commit(
        ['Journals/2026/05/2026-05-13.md'],
        '更新日记'
      );
      expect(result).toEqual(commit);
    });

    it('should throw GitCommitError when commit fails', async () => {
      vi.mocked(service.commit).mockRejectedValue(new GitCommitError());

      await expect(service.commit(['file.md'], 'test')).rejects.toThrow(GitCommitError);
    });
  });

  describe('getHistory', () => {
    it('should return version history for specific file', async () => {
      const history: VersionHistoryEntry[] = [
        {
          commit: {
            hash: 'abc1234',
            message: '更新日记',
            date: new Date(),
            files: ['Journals/2026/05/2026-05-13.md'],
          },
          changes: [
            { path: 'Journals/2026/05/2026-05-13.md', status: 'modified', additions: 5, deletions: 2 },
          ],
          isCurrent: true,
        },
      ];
      vi.mocked(service.getHistory).mockResolvedValue(history);

      const result = await service.getHistory('Journals/2026/05/2026-05-13.md');
      expect(result).toEqual(history);
    });

    it('should return global history when no file specified', async () => {
      vi.mocked(service.getHistory).mockResolvedValue([]);

      const result = await service.getHistory();
      expect(result).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      vi.mocked(service.getHistory).mockResolvedValue([]);

      await service.getHistory(undefined, 10);
      expect(service.getHistory).toHaveBeenCalledWith(undefined, 10);
    });
  });

  describe('rollbackFile', () => {
    it('should rollback file to specified version', async () => {
      vi.mocked(service.rollbackFile).mockResolvedValue(undefined);

      await expect(
        service.rollbackFile('Journals/2026/05/2026-05-13.md', 'abc1234')
      ).resolves.toBeUndefined();
    });

    it('should throw GitRollbackError when rollback fails', async () => {
      vi.mocked(service.rollbackFile).mockRejectedValue(new GitRollbackError());

      await expect(
        service.rollbackFile('file.md', 'abc1234')
      ).rejects.toThrow(GitRollbackError);
    });
  });

  describe('push', () => {
    it('should push to remote successfully', async () => {
      vi.mocked(service.push).mockResolvedValue(undefined);

      await expect(service.push()).resolves.toBeUndefined();
    });

    it('should throw GitRemoteNotConfiguredError when remote not configured', async () => {
      vi.mocked(service.push).mockRejectedValue(new GitRemoteNotConfiguredError());

      await expect(service.push()).rejects.toThrow(GitRemoteNotConfiguredError);
    });

    it('should throw GitPushError when push fails', async () => {
      vi.mocked(service.push).mockRejectedValue(new GitPushError());

      await expect(service.push()).rejects.toThrow(GitPushError);
    });
  });

  describe('pull', () => {
    it('should pull from remote successfully', async () => {
      vi.mocked(service.pull).mockResolvedValue(undefined);

      await expect(service.pull()).resolves.toBeUndefined();
    });

    it('should throw GitPullError with conflicts when pull has conflicts', async () => {
      const conflicts = ['Journals/2026/05/2026-05-13.md'];
      vi.mocked(service.pull).mockRejectedValue(new GitPullError(conflicts));

      await expect(service.pull()).rejects.toThrow(GitPullError);
    });
  });

  describe('hasConflicts', () => {
    it('should return true when there are conflicts', async () => {
      vi.mocked(service.hasConflicts).mockResolvedValue(true);

      const result = await service.hasConflicts();
      expect(result).toBe(true);
    });

    it('should return false when there are no conflicts', async () => {
      vi.mocked(service.hasConflicts).mockResolvedValue(false);

      const result = await service.hasConflicts();
      expect(result).toBe(false);
    });
  });

  describe('resolveConflict', () => {
    it('should resolve conflict with ours', async () => {
      vi.mocked(service.resolveConflict).mockResolvedValue(undefined);

      await expect(
        service.resolveConflict('file.md', 'ours')
      ).resolves.toBeUndefined();
    });

    it('should resolve conflict with theirs', async () => {
      vi.mocked(service.resolveConflict).mockResolvedValue(undefined);

      await expect(
        service.resolveConflict('file.md', 'theirs')
      ).resolves.toBeUndefined();
    });
  });
});
