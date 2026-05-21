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
import { GlobalModelsConfig, logger, parseDateStr, formatLocalDate } from '@baishou/shared';
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

let _cachedManager: SummaryManagerService | null = null;

function ensureManager(): SummaryManagerService {
  if (!_cachedManager) {
    _cachedManager = getSummaryManager();
  }
  return _cachedManager;
}

/**
 * 在 ZIP 恢复等场景下，DB 连接已被重建，必须使缓存的 Manager 失效
 * 否则其持有的 Repository 仍引用旧的（已断开）DB 实例
 */
export function resetCachedManager(): void {
  _cachedManager = null;
}

let _queueInitialized = false;

function ensureQueueReady(): void {
  if (_queueInitialized) return;
  const queueService = SummaryQueueService.getInstance();
  queueService.setDependencies(ensureManager(), async () => {
    const db = connectionManager.getDb();
    const shadowDb = shadowConnectionManager.getDb();
    
    const summaryRepo = new SummaryRepositoryImpl(db);
    const shadowRepo = new ShadowIndexRepository(shadowDb as any);
    
    const diaryRepoAdapter = {
      async findByDateRange(start: Date, end: Date) {
          const startIso = formatLocalDate(start);
          const endIso = formatLocalDate(end);
          const records = await shadowRepo.findByDateRange(startIso, endIso);
          return records.map((r: any) => {
             const diaryDate = parseDateStr(r.date);
             return {
               id: r.id.toString(),
               title: r.title,
               date: diaryDate,
               content: r.rawContent ?? r.content ?? '',
               tags: r.tags || '',
               createdAt: r.createdAt ? new Date(r.createdAt) : diaryDate,
               updatedAt: r.updatedAt ? new Date(r.updatedAt) : diaryDate
             };
          });
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
          } as any);
         return text;
      }
    };
    
    return new SummaryGeneratorService(diaryRepoAdapter, summaryRepo, aiClient);
  });
  _queueInitialized = true;
}

export function registerSummaryIPC() {
  ipcMain.handle('summary:save', async (_, input: CreateSummaryInput) => {
    return await ensureManager().save(input);
  });
  
  ipcMain.handle('summary:update', async (_, id: number, type: SummaryType, startDate: Date, endDate: Date, update: UpdateSummaryInput) => {
    return await ensureManager().update(id, type, new Date(startDate), new Date(endDate), update);
  });
  
  ipcMain.handle('summary:delete', async (_, type: SummaryType, startDate: Date, endDate: Date) => {
    return await ensureManager().delete(type, new Date(startDate), new Date(endDate));
  });
  
  ipcMain.handle('summary:readDetail', async (_, type: SummaryType, startDate: Date, endDate: Date) => {
    return await ensureManager().readDetail(type, new Date(startDate), new Date(endDate));
  });
  
  ipcMain.handle('summary:list', async (_, options?: { start?: Date }) => {
    try {
       const parsedOptions = options?.start ? { start: new Date(options.start) } : undefined;
       return await ensureManager().list(parsedOptions);
     } catch (e: any) {
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
       } catch(e: any) {
         // shadow_index table might not be initialized yet
         logger.error('Failed to get shadow_index count', e);
       }

      const summaries = await ensureManager().list();
      return {
        totalDiaryCount,
        weeklyCount: summaries.filter((s:any) => s.type === 'weekly').length,
        monthlyCount: summaries.filter((s:any) => s.type === 'monthly').length,
        quarterlyCount: summaries.filter((s:any) => s.type === 'quarterly').length,
        yearlyCount: summaries.filter((s:any) => s.type === 'yearly').length
      };
     } catch (err: any) {
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
               logger.info('[DEBUG-IPC] Sample record date field:', { date: records[0].date, type: typeof records[0].date });
            }
            return records.map((r: any) => {
              const diaryDate = parseDateStr(r.date);
              return {
                id: r.id.toString(),
                title: r.title,
                date: diaryDate,
                content: r.rawContent ?? r.content ?? '',
                tags: r.tags || '',
                createdAt: r.createdAt ? new Date(r.createdAt) : diaryDate,
                updatedAt: r.updatedAt ? new Date(r.updatedAt) : diaryDate,
                path: r.filePath || r.path || ''
              };
            });
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

  ipcMain.handle('summary:queue-generation', async (_, items: any[], concurrency?: number) => {
    ensureQueueReady();
    const queueService = SummaryQueueService.getInstance();
    queueService.enqueue(items, concurrency);
    return true;
  });

  ipcMain.handle('summary:set-concurrency', async (_, limit: number) => {
    ensureQueueReady();
    const queueService = SummaryQueueService.getInstance();
    queueService.setConcurrencyLimit(limit);
    return true;
  });

  ipcMain.handle('summary:get-queue-state', async () => {
    ensureQueueReady();
    const queueService = SummaryQueueService.getInstance();
    return queueService.getQueueState();
  });

  ipcMain.handle('summary:stop-generation', async () => {
    ensureQueueReady();
    const queueService = SummaryQueueService.getInstance();
    queueService.stop();
    return true;
  });

  ipcMain.handle('summary:buildSharedContext', async (_, lookbackMonths: number, locale?: string) => {
    try {
      const shadowDb = shadowConnectionManager.getDb();
      if (!shadowDb) return '';

      const shadowRepo = new ShadowIndexRepository(shadowDb as any);

      // 1. 计算时间范围
      const now = new Date();
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - lookbackMonths);
      cutoffDate.setDate(1);
      cutoffDate.setHours(0, 0, 0, 0);

      // 2. 获取所有的 summaries 和日记记录（带全文内容）
      const summaries = await ensureManager().list();
      const diaries = await shadowRepo.listAllWithFTS();

      // 3. 过滤并解析日期
      const relevantSummaries = (summaries || []).filter((s: any) => {
        const endDate = new Date(s.endDate);
        return endDate > cutoffDate;
      });

      const relevantDiaries = diaries.filter((d: any) => {
        const dDate = parseDateStr(d.date);
        return dDate >= cutoffDate && dDate <= now;
      });

      // 4. 按类型分类
      const yList = relevantSummaries.filter((s: any) => s.type === 'yearly');
      const qList = relevantSummaries.filter((s: any) => s.type === 'quarterly');
      const mList = relevantSummaries.filter((s: any) => s.type === 'monthly');
      const wList = relevantSummaries.filter((s: any) => s.type === 'weekly');

      // 5. 级联过滤逻辑 (Cascading Filter)
      // 被更高级别总结覆盖的 "YYYYMM" 集合
      const coveredMonthKeys = new Set<string>();

      // 将总结覆盖的月份添加到覆盖集合
      const markMonthsCovered = (s: any) => {
        const start = new Date(s.startDate);
        const end = new Date(s.endDate);
        
        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
        
        while (current <= endMonth) {
          const year = current.getFullYear();
          const month = String(current.getMonth() + 1).padStart(2, '0');
          const key = `${year}${month}`;
          coveredMonthKeys.add(key);
          current.setMonth(current.getMonth() + 1);
        }
      };

      // 5.1 季度覆盖月份
      for (const q of qList) {
        markMonthsCovered(q);
      }

      // 5.2 过滤可见月份（如果被 Q 覆盖则排除）
      const visibleMonths = mList.filter((m: any) => {
        const mStart = new Date(m.startDate);
        const year = mStart.getFullYear();
        const month = String(mStart.getMonth() + 1).padStart(2, '0');
        const key = `${year}${month}`;
        return !coveredMonthKeys.has(key);
      });

      // 5.3 将可见月份添加到覆盖集合（用于周/日记过滤）
      for (const m of visibleMonths) {
        markMonthsCovered(m);
      }

      // 5.4 过滤可见周
      const visibleWeeks = wList.filter((w: any) => {
        const wEnd = new Date(w.endDate);
        const year = wEnd.getFullYear();
        const month = String(wEnd.getMonth() + 1).padStart(2, '0');
        const key = `${year}${month}`;
        return !coveredMonthKeys.has(key);
      });

      // 5.5 过滤可见日记
      let diaryCutoffDate: Date | null = null;
      if (visibleWeeks.length > 0) {
        const weekDates = visibleWeeks.map((w: any) => new Date(w.endDate).getTime());
        diaryCutoffDate = new Date(Math.max(...weekDates));
      }

      const visibleDiaries = relevantDiaries.filter((d: any) => {
        const dDate = parseDateStr(d.date);
        const year = dDate.getFullYear();
        const month = String(dDate.getMonth() + 1).padStart(2, '0');
        const key = `${year}${month}`;

        // 1. 检查月份是否被 Q 或 M 覆盖
        if (coveredMonthKeys.has(key)) return false;

        // 2. 检查是否被周记覆盖
        if (diaryCutoffDate && dDate <= diaryCutoffDate) {
          return false;
        }
        return true;
      });

      // 6. 国际化字典
      const translations: Record<string, {
        yearly: string;
        quarterly: string;
        monthly: string;
        weekly: string;
        diary: string;
        subTitle: (months: number) => string;
        slangs: string[];
      }> = {
        zh: {
          yearly: '[年总结]',
          quarterly: '[季度总结]',
          monthly: '[月总结]',
          weekly: '[周总结]',
          diary: '[日记]',
          subTitle: (months) => `包含最近 ${months} 个月的关键人生节点记录与回忆`,
          slangs: [
            '📖 白守 · 共同回忆',
            '🌸 共同回忆 — 白守',
            '✨ 白守 | 共同回忆'
          ]
        },
        zh_TW: {
          yearly: '[年總結]',
          quarterly: '[季度總結]',
          monthly: '[月總結]',
          weekly: '[周總結]',
          diary: '[日記]',
          subTitle: (months) => `包含最近 ${months} 個月的關鍵人生節點記錄與回憶`,
          slangs: [
            '📖 白守 · 共同回憶',
            '🌸 共同回憶 — 白守',
            '✨ 白守 | 共同回憶'
          ]
        },
        en: {
          yearly: '[Yearly Summary]',
          quarterly: '[Quarterly Summary]',
          monthly: '[Monthly Summary]',
          weekly: '[Weekly Summary]',
          diary: '[Diary]',
          subTitle: (months) => `Includes key life events and memories from the past ${months} months`,
          slangs: [
            '📖 BaiShou · Shared Memories',
            '🌸 Shared Memories — BaiShou',
            '✨ BaiShou | Shared Memories'
          ]
        },
        ja: {
          yearly: '[年次のまとめ]',
          quarterly: '[四半期のまとめ]',
          monthly: '[月次のまとめ]',
          weekly: '[週次のまとめ]',
          diary: '[日記]',
          subTitle: (months) => `過去 ${months} ヶ月間の主要な人生の節目と记录を含みます`,
          slangs: [
            '📖 白守 · 共同の思い出',
            '🌸 共同の思い出 — 白守',
            '✨ 白守 | 共同の思い出'
          ]
        }
      };

      const normalizedLocale = (locale || 'zh').toLowerCase().replace('-', '_');
      let lang = 'zh';
      if (normalizedLocale.startsWith('zh_tw') || normalizedLocale.startsWith('zh_hk')) {
        lang = 'zh_TW';
      } else if (normalizedLocale.startsWith('zh')) {
        lang = 'zh';
      } else if (normalizedLocale.startsWith('en')) {
        lang = 'en';
      } else if (normalizedLocale.startsWith('ja')) {
        lang = 'ja';
      }
      
      const tDict = translations[lang] || translations['zh'];

      // 7. 统一构建 Markdown 集合并按日期升序排序
      const allItems: { date: Date; data: any; prefix: string }[] = [];

      for (const i of yList) {
        allItems.push({ date: new Date(i.startDate), data: i, prefix: tDict.yearly });
      }
      for (const i of qList) {
        allItems.push({ date: new Date(i.startDate), data: i, prefix: tDict.quarterly });
      }
      for (const i of visibleMonths) {
        allItems.push({ date: new Date(i.startDate), data: i, prefix: tDict.monthly });
      }
      for (const i of visibleWeeks) {
        allItems.push({ date: new Date(i.startDate), data: i, prefix: tDict.weekly });
      }
      for (const d of visibleDiaries) {
        allItems.push({ date: parseDateStr(d.date), data: d, prefix: tDict.diary });
      }

      // 按时间升序排序
      allItems.sort((a, b) => a.date.getTime() - b.date.getTime());

      if (allItems.length === 0) {
        return '';
      }

      const formatDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const formattedParts = allItems.map((item) => {
        const dateStr = formatDate(item.date);
        const content = item.prefix === tDict.diary ? (item.data.rawContent || '') : (item.data.content || '');
        return `## ${item.prefix} ${dateStr}\n\n${content}`;
      });

      // slang 风格随机标题，完美复现并本地化原版白守
      const slangs = tDict.slangs;
      const slang = slangs[Math.floor(Math.random() * slangs.length)];
      const header = `${slang}\n${tDict.subTitle(lookbackMonths)}\n`;

      return `${header}\n${formattedParts.join('\n\n---\n\n')}`;
    } catch (e) {
      logger.error('[SummaryIPC] buildSharedContext error:', e as any);
      return '';
    }
  });
}
