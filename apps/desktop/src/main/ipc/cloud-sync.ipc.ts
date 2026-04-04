import { ipcMain } from 'electron';
import { SyncIpcChannels } from '@baishou/shared';
import { SyncConfig } from '@baishou/core';
import { DesktopCloudSyncService } from '../services/cloud-sync.service';
import { archiveService } from './archive.ipc';

const cloudSyncService = new DesktopCloudSyncService(archiveService);

export function registerCloudSyncIPC() {
  // 立即同步
  ipcMain.handle(SyncIpcChannels.CLOUD_SYNC_NOW, async (_, config: SyncConfig) => {
    return await cloudSyncService.syncNow(config);
  });

  // 列出远端备份
  ipcMain.handle(SyncIpcChannels.CLOUD_LIST_RECORDS, async (_, config: SyncConfig) => {
    return await cloudSyncService.listRecords(config);
  });

  // 从云端恢复
  ipcMain.handle(SyncIpcChannels.CLOUD_RESTORE, async (_, config: SyncConfig, filename: string) => {
    return await cloudSyncService.restoreFromCloud(config, filename);
  });

  // 删除单个
  ipcMain.handle(SyncIpcChannels.CLOUD_DELETE_RECORD, async (_, config: SyncConfig, filename: string) => {
    await cloudSyncService.deleteRecord(config, filename);
    return true;
  });

  // 批量删除
  ipcMain.handle(SyncIpcChannels.CLOUD_BATCH_DELETE, async (_, config: SyncConfig, filenames: string[]) => {
    return await cloudSyncService.batchDeleteRecords(config, filenames);
  });

  // 重命名
  ipcMain.handle(SyncIpcChannels.CLOUD_RENAME, async (_, config: SyncConfig, oldName: string, newName: string) => {
    await cloudSyncService.renameRecord(config, oldName, newName);
    return true;
  });
}
