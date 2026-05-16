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

async function createSyncService(config: S3SyncConfig): Promise<IncrementalSyncServiceImpl> {
  const client = new IncrementalS3Client(
    config.endpoint,
    config.region,
    config.bucket,
    config.accessKey,
    config.secretKey,
    config.path,
  );

  const vaultPath = await pathService.getActiveVaultPath();
  if (vaultPath) {
    client.setVaultPath(vaultPath);
  }

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
    await createSyncService(merged);
    await syncService!.updateConfig(merged);
    return { success: true };
  });

  ipcMain.handle('incrementalSync:testConnection', async () => {
    return getSyncService().testConnection();
  });

  ipcMain.handle('incrementalSync:sync', async () => {
    const result = await getSyncService().sync();
    // 增量同步下载了新文件后，必须触发全生态重扫
    // 确保 summaries 表等 DB 缓存与磁盘文件保持一致
    if (result.downloaded.length > 0) {
      const { globalBootstrapper } = await import('../services/bootstrapper.service');
      await globalBootstrapper.fullyResyncAllEcosystems();
    }
    return result;
  });

  ipcMain.handle('incrementalSync:uploadOnly', async () => {
    return getSyncService().uploadOnly();
  });

  ipcMain.handle('incrementalSync:downloadOnly', async () => {
    const result = await getSyncService().downloadOnly();
    if (result.downloaded.length > 0) {
      const { globalBootstrapper } = await import('../services/bootstrapper.service');
      await globalBootstrapper.fullyResyncAllEcosystems();
    }
    return result;
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
