import { ipcMain } from 'electron';
import { 
  SummaryRepositoryImpl,
  connectionManager 
} from '@baishou/database';
import { 
  SummaryManagerService,
  SummarySyncService,
  SummaryFileService
} from '@baishou/core';

import { pathService } from './vault.ipc';
import { CreateSummaryInput, UpdateSummaryInput, SummaryType } from '@baishou/shared';

export function getSummaryManager() {
  const db = connectionManager.getDb();
  
  const summaryRepo = new SummaryRepositoryImpl(db);
  const fileSync = new SummaryFileService(pathService);
  const summarySync = new SummarySyncService({} as any, {} as any, summaryRepo, fileSync);
  
  const summaryManager = new SummaryManagerService(
    summaryRepo,
    fileSync,
    summarySync
  );
  
  return summaryManager;
}

export function registerSummaryIPC() {
  ipcMain.handle('summary:save', async (_, input: CreateSummaryInput) => {
    return await getSummaryManager().save(input);
  });
  
  ipcMain.handle('summary:update', async (_, id: number, type: SummaryType, startDate: Date, endDate: Date, update: UpdateSummaryInput) => {
    return await getSummaryManager().update(id, type, new Date(startDate), new Date(endDate), update);
  });
  
  ipcMain.handle('summary:delete', async (_, type: SummaryType, startDate: Date, endDate: Date) => {
    return await getSummaryManager().delete(type, new Date(startDate), new Date(endDate));
  });
  
  ipcMain.handle('summary:readDetail', async (_, type: SummaryType, startDate: Date, endDate: Date) => {
    return await getSummaryManager().readDetail(type, new Date(startDate), new Date(endDate));
  });
  
  ipcMain.handle('summary:list', async (_, options?: { start?: Date }) => {
    // Deserialize optional date object if present
    const parsedOptions = options?.start ? { start: new Date(options.start) } : undefined;
    return await getSummaryManager().list(parsedOptions);
  });

  ipcMain.handle('summary:stats', async () => {
    // 目前使用空桩实现以阻断报错，日后可替换为真实的探测器调用
    return {
      totalDiaryCount: 0,
      weeklyCount: 0,
      monthlyCount: 0,
      quarterlyCount: 0,
      yearlyCount: 0
    };
  });

  ipcMain.handle('summary:detect-missing', async () => {
    return [];
  });

  ipcMain.handle('summary:generate', async (_, args: any) => {
    return null;
  });
}
