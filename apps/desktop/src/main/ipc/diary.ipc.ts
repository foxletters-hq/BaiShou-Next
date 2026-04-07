import { ipcMain } from 'electron';
import {
  ShadowIndexRepository,
  shadowConnectionManager
} from '@baishou/database';
import {
  DiaryService,
  FileSyncServiceImpl,
  ShadowIndexSyncService,
  VaultIndexServiceImpl
} from '@baishou/core';

import { pathService, vaultService } from './vault.ipc';
import { CreateDiaryInput, UpdateDiaryInput } from '@baishou/shared';

/**
 * 日记管理服务工厂
 *
 * 重要架构变更（双库分离）：
 * - 日记影子索引现在从 shadowConnectionManager.getDb() 获取（shadow_index.db）
 * - 不再使用主 Agent DB（connectionManager.getDb()）
 * - 每次 IPC 调用时都从 shadowConnectionManager 取最新连接，保证 Vault 切换后的自动跟随
 */
export function getDiaryManager() {
  // 从影子索引专属 DB 获取，而非 Agent DB
  const shadowDb = shadowConnectionManager.getDb();

  const shadowRepo = new ShadowIndexRepository(shadowDb);
  const fileSync = new FileSyncServiceImpl(pathService);
  const shadowSync = new ShadowIndexSyncService(shadowRepo, pathService, vaultService);
  const vaultIndex = new VaultIndexServiceImpl();

  const diaryService = new DiaryService(
    shadowRepo,
    fileSync,
    shadowSync,
    vaultIndex
  );

  return diaryService;
}

export function registerDiaryIPC() {
  ipcMain.handle('diary:create', async (_, input: CreateDiaryInput) => {
    if (input.date && typeof input.date === 'string') {
      input.date = new Date(input.date);
    }
    return await getDiaryManager().create(input);
  });

  ipcMain.handle('diary:update', async (_, id: number, input: UpdateDiaryInput) => {
    if (input.date && typeof input.date === 'string') {
      input.date = new Date(input.date);
    }
    return await getDiaryManager().update(id, input);
  });

  ipcMain.handle('diary:delete', async (_, id: number) => {
    return await getDiaryManager().delete(id);
  });

  ipcMain.handle('diary:findById', async (_, id: number) => {
    return await getDiaryManager().findById(id);
  });

  ipcMain.handle('diary:findByDate', async (_, dateStr: string) => {
    return await getDiaryManager().findByDate(new Date(dateStr));
  });

  ipcMain.handle('diary:listAll', async (_, options?: { limit?: number; offset?: number }) => {
    return await getDiaryManager().listAll(options);
  });

  ipcMain.handle('diary:list', async (_, options?: { limit?: number; offset?: number }) => {
    return await getDiaryManager().listAll(options);
  });

  ipcMain.handle('diary:search', async (_, query: string, options?: { limit?: number; offset?: number }) => {
    return await getDiaryManager().search(query, options);
  });

  ipcMain.handle('diary:count', async () => {
    return await getDiaryManager().count();
  });
}
