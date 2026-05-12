import { ipcMain } from 'electron';
import { logger } from '@baishou/shared';
import { GitSyncServiceImpl } from '@baishou/core';
import {
  GitCommitError,
  GitPushError,
  GitPullError,
  GitRemoteNotConfiguredError,
} from '@baishou/core';
import { pathService } from './vault.ipc';

let gitService: GitSyncServiceImpl | null = null;

function getGitService(): GitSyncServiceImpl {
  if (!gitService) {
    gitService = new GitSyncServiceImpl(pathService);
  }
  return gitService;
}

export function registerGitSyncIPC() {
  ipcMain.handle('git:init', async () => {
    try {
      await getGitService().init();
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Git init failed' };
    }
  });

  ipcMain.handle('git:isInitialized', async () => {
    return getGitService().isInitialized();
  });

  ipcMain.handle('git:getConfig', async () => {
    return getGitService().getConfig();
  });

  ipcMain.handle('git:updateConfig', async (_, config: any) => {
    await getGitService().updateConfig(config);
    return { success: true };
  });

  ipcMain.handle('git:testRemote', async () => {
    return getGitService().testRemoteConnection();
  });

  ipcMain.handle('git:autoCommit', async () => {
    try {
      const result = await getGitService().autoCommit();
      return { success: true, data: result };
    } catch (e: any) {
      throw new GitCommitError(e instanceof Error ? e : undefined);
    }
  });

  ipcMain.handle('git:commitAll', async (_, message: string) => {
    return getGitService().commitAll(message);
  });

  ipcMain.handle('git:commit', async (_, files: string[], message: string) => {
    return getGitService().commit(files, message);
  });

  ipcMain.handle('git:getHistory', async (_, filePath?: string, limit?: number, offset?: number) => {
    return getGitService().getHistory(filePath, limit, offset);
  });

  ipcMain.handle('git:getCommitChanges', async (_, commitHash: string) => {
    return getGitService().getCommitChanges(commitHash);
  });

  ipcMain.handle('git:getFileDiff', async (_, filePath: string, commitHash?: string) => {
    return getGitService().getFileDiff(filePath, commitHash);
  });

  ipcMain.handle('git:rollbackFile', async (_, filePath: string, commitHash: string) => {
    try {
      await getGitService().rollbackFile(filePath, commitHash);
      return { success: true };
    } catch (e: any) {
      logger.error(`[GitIPC] 回滚文件失败: ${e?.message}`);
      return { success: false, message: e?.message || 'Rollback failed' };
    }
  });

  ipcMain.handle('git:rollbackAll', async (_, commitHash: string) => {
    try {
      await getGitService().rollbackAll(commitHash);
      return { success: true };
    } catch (e: any) {
      logger.error(`[GitIPC] 回滚仓库失败: ${e?.message}`);
      return { success: false, message: e?.message || 'Rollback all failed' };
    }
  });

  ipcMain.handle('git:push', async () => {
    try {
      await getGitService().push();
      return { success: true };
    } catch (e: any) {
      if (e instanceof GitRemoteNotConfiguredError) {
        return { success: false, message: '未配置远程仓库' };
      }
      throw new GitPushError(e instanceof Error ? e : undefined);
    }
  });

  ipcMain.handle('git:pull', async () => {
    try {
      await getGitService().pull();
      return { success: true };
    } catch (e: any) {
      if (e instanceof GitRemoteNotConfiguredError) {
        return { success: false, message: '未配置远程仓库' };
      }
      if (e instanceof GitPullError) {
        return { success: false, message: e.message, conflicts: e.conflicts || [] };
      }
      throw e;
    }
  });

  ipcMain.handle('git:hasConflicts', async () => {
    return getGitService().hasConflicts();
  });

  ipcMain.handle('git:getConflicts', async () => {
    return getGitService().getConflicts();
  });

  ipcMain.handle('git:resolveConflict', async (_, filePath: string, resolution: 'ours' | 'theirs') => {
    await getGitService().resolveConflict(filePath, resolution);
    return { success: true };
  });
}
