import { ipcMain } from 'electron';
import * as crypto from 'crypto';
import * as path from 'path';
import {
  IncrementalSyncServiceImpl,
  ThreeWaySyncService,
  SyncOrchestrator,
  OperationLogService,
} from '@baishou/core';
import type { S3SyncConfig } from '@baishou/shared';
import { IncrementalS3Client } from '../services/incremental-s3.client';
import { pathService } from './vault.ipc';
import { getGitService } from './git-sync.ipc';

let syncService: IncrementalSyncServiceImpl | null = null;
let threeWayService: ThreeWaySyncService | null = null;
let orchestrator: SyncOrchestrator | null = null;

function getSyncService(): IncrementalSyncServiceImpl {
  if (!syncService) {
    throw new Error('Incremental sync service not initialized. Please update config first.');
  }
  return syncService;
}

function getOrchestrator(): SyncOrchestrator {
  if (!orchestrator) {
    throw new Error('Sync orchestrator not initialized. Please update config first.');
  }
  return orchestrator;
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
  const deviceId = 'desktop-' + crypto.randomUUID().substring(0, 8);

  if (vaultPath) {
    client.setVaultPath(vaultPath);

    // 旧版服务（两向对比，保持向后兼容）
    syncService = new IncrementalSyncServiceImpl(pathService, client, deviceId);

    // 新版服务（三向合并 + 删除传播）
    threeWayService = new ThreeWaySyncService(pathService, client, deviceId);

    // 操作日志
    const logDir = path.join(vaultPath, '.baishou', 'sync-log');
    const logService = new OperationLogService(logDir);

    // Git 服务
    const gitService = getGitService();
    const gitInit = await gitService.isInitialized();

    // 编排器（使用新版三向合并服务 + git 预提交 + 操作日志）
    orchestrator = new SyncOrchestrator(
      threeWayService,
      logService,
      gitInit ? gitService : undefined,
      deviceId,
    );
  } else {
    syncService = new IncrementalSyncServiceImpl(pathService, client, deviceId);
  }

  return syncService;
}

export function registerIncrementalSyncIPC() {
  ipcMain.handle('incrementalSync:getConfig', async () => {
    if (!syncService) {
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
    if (result.downloaded.length > 0 || result.deletedLocal.length > 0) {
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
    if (result.downloaded.length > 0 || result.deletedLocal.length > 0) {
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

  // ── 编排器一键同步 API ─────────────────────────────────────

  ipcMain.handle('incrementalSync:orchestratedSync', async () => {
    const result = await getOrchestrator().sync();
    if (result.downloaded.length > 0 || result.deletedLocal.length > 0) {
      const { globalBootstrapper } = await import('../services/bootstrapper.service');
      await globalBootstrapper.fullyResyncAllEcosystems();
    }
    return result;
  });

  ipcMain.handle('incrementalSync:orchestratedUploadOnly', async () => {
    return getOrchestrator().uploadOnly();
  });

  ipcMain.handle('incrementalSync:orchestratedDownloadOnly', async () => {
    const result = await getOrchestrator().downloadOnly();
    if (result.downloaded.length > 0 || result.deletedLocal.length > 0) {
      const { globalBootstrapper } = await import('../services/bootstrapper.service');
      await globalBootstrapper.fullyResyncAllEcosystems();
    }
    return result;
  });

  ipcMain.handle('incrementalSync:getSyncHistory', async (_, limit?: number) => {
    return getOrchestrator().getSyncHistory(limit);
  });

  ipcMain.handle('incrementalSync:getLastSyncSummary', async () => {
    return getOrchestrator().getSyncHistory(1).then((logs) => {
      if (logs.length > 0 && logs[0]!.success) {
        return logs[0]!.summary;
      }
      return null;
    });
  });
}
