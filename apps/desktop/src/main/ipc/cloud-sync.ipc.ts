import { ipcMain } from 'electron';
import { SyncIpcChannels } from '@baishou/shared';
import { SyncConfig } from '@baishou/core';
import { DesktopCloudSyncService } from '../services/cloud-sync.service';
import { archiveService } from './archive.ipc';

const cloudSyncService = new DesktopCloudSyncService(archiveService);

export function registerCloudSyncIPC() {
  // 立即同步
  ipcMain.handle('cloud:syncNow', async (_, config: SyncConfig) => {
    return await cloudSyncService.syncNow(config);
  });

  // 列出远端备份
  ipcMain.handle('cloud:listRecords', async (_, config: SyncConfig) => {
    return await cloudSyncService.listRecords(config);
  });

  // 从云端恢复
  ipcMain.handle('cloud:restore', async (_, config: SyncConfig, filename: string) => {
    return await cloudSyncService.restoreFromCloud(config, filename);
  });

  // 下载备份包至本地
  ipcMain.handle('cloud:downloadRecord', async (event, config: SyncConfig, remoteFilename: string) => {
    const { dialog } = require('electron');
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '下载云端备份包',
      defaultPath: remoteFilename,
      filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
    });
    if (canceled || !filePath) return { success: false, message: '已取消下载' };
    return await cloudSyncService.downloadToLocal(config, remoteFilename, filePath);
  });

  // 删除单个
  ipcMain.handle('cloud:deleteRecord', async (_, config: SyncConfig, filename: string) => {
    await cloudSyncService.deleteRecord(config, filename);
    return true;
  });

  // 批量删除
  ipcMain.handle('cloud:batchDelete', async (_, config: SyncConfig, filenames: string[]) => {
    return await cloudSyncService.batchDeleteRecords(config, filenames);
  });

  // 重命名
  ipcMain.handle('cloud:rename', async (_, config: SyncConfig, oldName: string, newName: string) => {
    await cloudSyncService.renameRecord(config, oldName, newName);
    return true;
  });
}
