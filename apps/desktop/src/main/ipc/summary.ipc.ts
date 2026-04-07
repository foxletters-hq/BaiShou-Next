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
    try {
      let totalDiaryCount = 0;
      try {
        const { shadowConnectionManager } = require('@baishou/database');
        const client = shadowConnectionManager.getClient();
        const result = await client.execute('SELECT COUNT(*) as c FROM journals_index');
        totalDiaryCount = (result.rows[0]?.c as number) || 0;
      } catch(e) {
        // shadow_index table might not be initialized yet
        console.error('Failed to get shadow_index count', e);
      }

      const summaries = await getSummaryManager().list();
      return {
        totalDiaryCount,
        weeklyCount: summaries.filter((s:any) => s.type === 'weekly').length,
        monthlyCount: summaries.filter((s:any) => s.type === 'monthly').length,
        quarterlyCount: summaries.filter((s:any) => s.type === 'quarterly').length,
        yearlyCount: summaries.filter((s:any) => s.type === 'yearly').length
      };
    } catch (err) {
      console.error('Failed to calculate summary stats:', err);
      return {
        totalDiaryCount: 0,
        weeklyCount: 0,
        monthlyCount: 0,
        quarterlyCount: 0,
        yearlyCount: 0
      };
    }
  });

  ipcMain.handle('summary:detect-missing', async () => {
    return [];
  });

  ipcMain.handle('summary:generate', async (_, args: any) => {
    return null;
  });
}
