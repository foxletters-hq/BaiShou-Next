import { ipcMain } from 'electron';
import { 
  ShadowIndexRepository, 
  connectionManager 
} from '@baishou/database';
import { 
  DiaryService,
  FileSyncServiceImpl,
  ShadowIndexSyncService,
  VaultIndexServiceImpl
} from '@baishou/core';

import { pathService, vaultService } from './vault.ipc';
import { CreateDiaryInput, UpdateDiaryInput } from '@baishou/shared';

// 懒加载代理：确保每一次响应 IPC 时都锁定在用户当前所切环境的 Database 句柄上
export function getDiaryManager() {
  const db = connectionManager.getDb();
  
  const shadowRepo = new ShadowIndexRepository(db);
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
