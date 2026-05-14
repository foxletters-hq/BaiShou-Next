import { ipcMain } from 'electron';
import { logger } from '@baishou/shared';
import { GitSyncServiceImpl } from '@baishou/core';
import {
  GitPullError,
  GitRemoteNotConfiguredError,
} from '@baishou/core';
import { pathService } from './vault.ipc';

let gitService: GitSyncServiceImpl | null = null;

export function getGitService(): GitSyncServiceImpl {
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

  ipcMain.handle('git:getStatus', async () => {
    return getGitService().getStatus();
  });

  ipcMain.handle('git:unstageFile', async (_, filePath: string) => {
    await getGitService().unstageFile(filePath);
    return { success: true };
  });

  ipcMain.handle('git:discardFile', async (_, filePath: string) => {
    await getGitService().discardFile(filePath);
    return { success: true };
  });

  ipcMain.handle('git:discardAllChanges', async () => {
    await getGitService().discardAllChanges();
    return { success: true };
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

  ipcMain.handle('git:commitAll', async (_, message: string) => {
    return getGitService().commitAll(message);
  });

  ipcMain.handle('git:commit', async (_, files: string[], message: string) => {
    return getGitService().commit(files, message);
  });

  ipcMain.handle('git:getHistory', async (_, filePath?: string, limit?: number, offset?: number) => {
    return getGitService().getHistory(filePath, limit, offset);
  });

  ipcMain.handle('git:getRecentPulls', async (_, limit?: number) => {
    return getGitService().getRecentPulls(limit);
  });

  ipcMain.handle('git:getCommitChanges', async (_, commitHash: string) => {
    return getGitService().getCommitChanges(commitHash);
  });

  ipcMain.handle('git:getFileDiff', async (_, filePath: string, commitHash?: string) => {
    return getGitService().getFileDiff(filePath, commitHash);
  });

  ipcMain.handle('git:getWorkingDiff', async (_, filePath: string, staged: boolean) => {
    return getGitService().getWorkingDiff(filePath, staged);
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
      logger.error(`[GitIPC] 推送失败:`, e as any);
      return { success: false, message: e?.message || '推送失败' };
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
      logger.error(`[GitIPC] 拉取失败:`, e as any);
      return { success: false, message: e?.message || '拉取失败' };
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
