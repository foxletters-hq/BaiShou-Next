import { ipcMain } from 'electron';
import { 
  SummaryRepositoryImpl,
  connectionManager,
  shadowConnectionManager,
  ShadowIndexRepository
} from '@baishou/database';
import { 
  SummaryManagerService,
  SummarySyncService,
  SummaryFileService,
  MissingSummaryDetector,
  SummaryGeneratorService,
  SummaryAiClient
} from '@baishou/core';
import { generateText } from 'ai';
import { settingsManager } from './settings.ipc';
import { getActiveProvider } from './agent-helpers';
import { GlobalModelsConfig, logger } from '@baishou/shared';
import { SummaryQueueService } from '../services/summary-queue.service';

import { pathService } from './vault.ipc';
import { CreateSummaryInput, UpdateSummaryInput, SummaryType } from '@baishou/shared';

export function getSummaryManager() {
  const db = connectionManager.getDb();
  
  // Ensure the table exists in local.db since migrations may not have run
  try {
    const rawClient = (connectionManager as any)._sqliteDb;
    if (rawClient) {
      rawClient.execute(`
        CREATE TABLE IF NOT EXISTS summaries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `).catch(() => {});
    }
  } catch (e) {}
  
  const summaryRepo = new SummaryRepositoryImpl(db);
  const fileSync = new SummaryFileService(pathService);
  const summarySync = new SummarySyncService(null, null, summaryRepo, fileSync);
  
  const summaryManager = new SummaryManagerService(
    summaryRepo,
    fileSync,
    summarySync
  );
  
  return summaryManager;
}

export function registerSummaryIPC() {
  const queueService = SummaryQueueService.getInstance();
  queueService.setDependencies(getSummaryManager(), async () => {
    // Dynamic factory for Generator Service to ensure db connections are fresh
    const db = connectionManager.getDb();
    const shadowDb = shadowConnectionManager.getDb();
    
    const summaryRepo = new SummaryRepositoryImpl(db);
    const shadowRepo = new ShadowIndexRepository(shadowDb as any);
    
    const diaryRepoAdapter = {
      async findByDateRange(start: Date, end: Date) {
          const records = await shadowRepo.listAll();
          return records.filter((r: any) => {
             const d = new Date(r.date).getTime();
             return d >= start.getTime() && d <= end.getTime();
          }).map((r: any) => ({
             id: r.id.toString(),
             title: r.title,
             date: new Date(r.date),
             content: r.content,
             tags: r.tags || '',
             createdAt: r.createdAt ? new Date(r.createdAt) : new Date(r.date),
             updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(r.date)
          }));
      }
    } as any;
    
    const aiClient: SummaryAiClient = {
      async generateContent(prompt: string, modelId: string): Promise<string> {
         const provider = await getActiveProvider();
         const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models');
         
         const summaryProviderId = globalModels?.globalSummaryProviderId || provider.config.id;
         let finalProvider = provider;
         if (summaryProviderId !== provider.config.id) {
            try { finalProvider = await getActiveProvider(summaryProviderId); } catch(e) {}
         }
         
         const finalModelId = globalModels?.globalSummaryModelId || modelId || 'deepseek-chat';
         const model = finalProvider.getLanguageModel(finalModelId);
         
         const { text } = await generateText({
            model,
            prompt,
            maxSteps: 1
         });
         return text;
      }
    };
    
    return new SummaryGeneratorService(diaryRepoAdapter, summaryRepo, aiClient);
  });
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
    try {
       const parsedOptions = options?.start ? { start: new Date(options.start) } : undefined;
       return await getSummaryManager().list(parsedOptions);
    } catch (e) {
       logger.warn('[SummaryIPC] list error (likely table missing):', e);
       return [];
    }
  });

  ipcMain.handle('summary:stats', async () => {
    try {
      let totalDiaryCount = 0;
      try {
        const client = shadowConnectionManager.getClient();
        const result = await client.execute('SELECT COUNT(*) as c FROM journals_index');
        totalDiaryCount = (result.rows[0]?.c as number) || 0;
      } catch(e) {
        // shadow_index table might not be initialized yet
        logger.error('Failed to get shadow_index count', e);
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
      logger.error('Failed to calculate summary stats:', err);
      return {
        totalDiaryCount: 0,
        weeklyCount: 0,
        monthlyCount: 0,
        quarterlyCount: 0,
        yearlyCount: 0
      };
    }
  });

  ipcMain.handle('summary:detect-missing', async (_, locale: string = 'zh') => {
    try {
      const db = connectionManager.getDb();
      const shadowDb = shadowConnectionManager.getDb();
      if (!shadowDb) return [];
      
      try {
         const rawClient = (connectionManager as any)._sqliteDb;
         if (rawClient) {
            await rawClient.execute(`
              CREATE TABLE IF NOT EXISTS summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
              )
            `);
         }
      } catch (e) {}

      const shadowRepo = new ShadowIndexRepository(shadowDb as any);
      const summaryRepo = new SummaryRepositoryImpl(db);

      const diaryRepoAdapter = {
        async list() {
            const records = await shadowRepo.listAll();
            logger.info('[DEBUG-IPC] shadowRepo.listAll count:', records.length);
            if (records.length > 0) {
               logger.info('[DEBUG-IPC] Sample record date field:', records[0].date, typeof records[0].date);
            }
            return records.map((r: any) => ({
              id: r.id.toString(),
              title: r.title,
              date: new Date(r.date),
              content: r.content,
              createdAt: r.createdAt ? new Date(r.createdAt) : new Date(r.date),
              updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(r.date),
              path: r.path || ''
            }));
        }
      } as any;

      const detector = new MissingSummaryDetector(diaryRepoAdapter, summaryRepo);
      const res = await detector.getAllMissing(locale);
      
      require('fs').writeFileSync(require('path').join(process.cwd(), 'detect-debug.log'), JSON.stringify({ count: res.length }));
      
      return res;
    } catch(err: any) {
      logger.error('[SummaryIPC] detect-missing error:', err);
      try {
         require('fs').writeFileSync(require('path').join(process.cwd(), 'detect-err.log'), err.stack || err.toString());
      } catch (e) {}
      return [];
    }
  });

  ipcMain.handle('summary:queue-generation', async (_, items: any[]) => {
    const queueService = SummaryQueueService.getInstance();
    queueService.enqueue(items);
    return true;
  });

  ipcMain.handle('summary:get-queue-state', async () => {
    const queueService = SummaryQueueService.getInstance();
    return queueService.getQueueState();
  });
}
