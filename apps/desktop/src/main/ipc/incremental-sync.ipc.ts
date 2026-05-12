import { ipcMain } from 'electron';
import * as crypto from 'crypto';
import {
  IncrementalSyncServiceImpl,
} from '@baishou/core';
import type { S3SyncConfig } from '@baishou/shared';
import { IncrementalS3Client } from '../services/incremental-s3.client';
import { pathService } from './vault.ipc';

let syncService: IncrementalSyncServiceImpl | null = null;

function getSyncService(): IncrementalSyncServiceImpl {
  // incremental sync service 根据配置动态创建（S3 配置变化时需要重建）
  if (!syncService) {
    throw new Error('Incremental sync service not initialized. Please update config first.');
  }
  return syncService;
}

function createSyncService(config: S3SyncConfig): IncrementalSyncServiceImpl {
  const client = new IncrementalS3Client(
    config.endpoint,
    config.region,
    config.bucket,
    config.accessKey,
    config.secretKey,
    config.path,
  );

  const deviceId = 'desktop-' + crypto.randomUUID().substring(0, 8);
  syncService = new IncrementalSyncServiceImpl(pathService, client, deviceId);
  return syncService;
}

export function registerIncrementalSyncIPC() {
  ipcMain.handle('incrementalSync:getConfig', async () => {
    if (!syncService) {
      // 返回默认空配置
      return {
        enabled: false,
        endpoint: '',
        region: '',
        bucket: '',
        path: 'baishou/',
        accessKey: '',
        secretKey: '',
      };
    }
    return syncService.getConfig();
  });

  ipcMain.handle('incrementalSync:updateConfig', async (_, config: Partial<S3SyncConfig>) => {
    const merged = {
      enabled: true,
      endpoint: '',
      region: '',
      bucket: '',
      path: 'baishou/',
      accessKey: '',
      secretKey: '',
      ...config,
    };
    createSyncService(merged);
    await syncService!.updateConfig(merged);
    return { success: true };
  });

  ipcMain.handle('incrementalSync:testConnection', async () => {
    return getSyncService().testConnection();
  });

  ipcMain.handle('incrementalSync:sync', async () => {
    return getSyncService().sync();
  });

  ipcMain.handle('incrementalSync:uploadOnly', async () => {
    return getSyncService().uploadOnly();
  });

  ipcMain.handle('incrementalSync:downloadOnly', async () => {
    return getSyncService().downloadOnly();
  });

  ipcMain.handle('incrementalSync:getLocalManifest', async () => {
    return getSyncService().getLocalManifest();
  });

  ipcMain.handle('incrementalSync:getRemoteManifest', async () => {
    return getSyncService().getRemoteManifest();
  });

  ipcMain.handle('incrementalSync:refreshLocalManifest', async () => {
    return getSyncService().refreshLocalManifest();
  });

  ipcMain.handle('incrementalSync:getLastSyncConflicts', async () => {
    return getSyncService().getLastSyncConflicts();
  });
}
