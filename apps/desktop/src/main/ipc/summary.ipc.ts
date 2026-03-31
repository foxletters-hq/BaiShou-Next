import { ipcMain } from 'electron';
import { 
  SummaryRepositoryImpl,
  connectionManager 
} from '@baishou/database';
import { 
  SummaryManagerService,
  SummarySyncService,
  SummaryFileService,
  SummaryType
} from '@baishou/core';

import { pathService } from './vault.ipc';
import { CreateSummaryInput, UpdateSummaryInput } from '@baishou/shared';

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
}
