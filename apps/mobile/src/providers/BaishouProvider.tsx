import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SQLite from 'expo-sqlite';
import { initExpoDatabase } from '@baishou/database/src/expo';
import {
  SessionManagerService,
  DiaryService,
  SettingsManagerService,
  SummaryManagerService,
  SessionFileService,
  SessionSyncService,
  AssistantFileService,
  AssistantManagerService,
  SettingsFileService,
  FileSyncService,
  FileSyncServiceImpl,
  VaultIndexService,
  VaultIndexServiceImpl,
  SummaryFileService,
  SummarySyncService,
  ShadowIndexSyncService,
  VaultService,
} from '@baishou/core';

import {
  SessionRepository,
  AssistantRepository,
  ShadowIndexRepository,
  SettingsRepository,
  SummaryRepositoryImpl,
  SnapshotRepository,
} from '@baishou/database/src/expo';

import {
  AIProviderRegistry,
  ToolRegistry,
  AgentSessionService,
  StreamChatCallbacks,
} from '@baishou/ai';

import { MobileStoragePathService } from '../services/path.service';
import { MobileArchiveService } from '../services/archive.service';
import { MobileLanSyncService } from '../services/lan-sync.service';
import { MobileCloudSyncService } from '../services/cloud-sync.service';

// 采用类似于桌面端 db.ts 里的静态导出，但在 RN 里我们走 Context 更加 React 化
interface BaishouContextValue {
  dbReady: boolean;
  services: {
    agentService: AgentSessionService;
    sessionManager: SessionManagerService;
    diaryService: DiaryService;
    settingsManager: SettingsManagerService;
    summaryManager: SummaryManagerService;
    archiveService: MobileArchiveService;
    lanSyncService: MobileLanSyncService;
    cloudSyncService: MobileCloudSyncService;
  } | null;
  startAgentChat?: (
    sessionId: string,
    userText: string,
    callbacks: StreamChatCallbacks,
    overrides?: { providerId?: string; modelId?: string; searchMode?: boolean },
  ) => Promise<void>;
}

const BaishouContext = createContext<BaishouContextValue>({ dbReady: false, services: null });

export const useBaishou = () => useContext(BaishouContext);

/** 使用 native fetch 获取网页内容并剥离 HTML */
async function webFetchContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const html = await response.text();

    let plainText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '\n');
    plainText = plainText.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '\n');
    plainText = plainText.replace(/<[^>]+>/g, ' ');
    plainText = plainText.replace(/\s+/g, ' ').trim();

    const LIMIT = 15000;
    if (plainText.length > LIMIT) {
      plainText = plainText.substring(0, LIMIT) + '\n\n[Content truncated due to length limits...]';
    }

    return plainText || 'The webpage is empty or cannot be parsed textually.';
  } catch (e: any) {
    console.error(`Failed to fetch URL: ${url}`, e);
    return `Failed to read URL: ${e.message || String(e)}`;
  }
}

/** 搜索 DuckDuckGo 并获取搜索结果页面 */
async function fetchDuckDuckGoSearch(query: string): Promise<string> {
  const encoded = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${encoded}`;
  return webFetchContent(url);
}

export function BaishouProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<BaishouContextValue>({ dbReady: false, services: null });

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        // 1. 初始化 SQLite 环境
        const expoDb = await SQLite.openDatabaseAsync('baishou_next_mobile.db');

        try {
        } catch (e) {
           console.warn('Native sqlite-vec extension not detected on mobile. RAG will fallback to JS calculation.');
        }

        // 2. 注入 Drizzle 层
        const { drizzleDb, driver } = initExpoDatabase(expoDb as any);

        const pathService = new MobileStoragePathService() as any;
        await pathService.getRootDirectory(); // trigger initialize

        // 3. 构建 Repositories
        const sessionRepo = new SessionRepository(drizzleDb);
        const assistantRepo = new AssistantRepository(drizzleDb);
        const shadowRepo = new ShadowIndexRepository(drizzleDb);
        const settingsRepo = new SettingsRepository(drizzleDb);
        const summaryRepo = new SummaryRepositoryImpl(drizzleDb);

        const snapshotRepo = new SnapshotRepository(drizzleDb);

        // 4. 构建 Core Services并进行依赖注入
        const sessionFileService = new SessionFileService(pathService);
        const sessionSyncService = new SessionSyncService(sessionRepo, sessionFileService);
        const sessionManager = new SessionManagerService(sessionRepo, sessionFileService, sessionSyncService);

        const assistantFileService = new AssistantFileService(pathService);
        const assistantManager = new AssistantManagerService(assistantRepo, assistantFileService);

        const fileSyncService = new FileSyncServiceImpl(pathService);
        const vaultIndexService = new VaultIndexServiceImpl();
        const vaultService = new VaultService(pathService);
        await vaultService.initRegistry();
        const shadowIndexSyncService = new ShadowIndexSyncService(shadowRepo, pathService, vaultService);
        const diaryService = new DiaryService(shadowRepo, fileSyncService, shadowIndexSyncService, vaultIndexService);

        const settingsFileService = new SettingsFileService(pathService);
        const settingsManager = new SettingsManagerService(settingsRepo, settingsFileService);

        const summaryFileService = new SummaryFileService(pathService);
        const summarySyncService = new SummarySyncService(null as any, null as any, summaryRepo, summaryFileService);
        const summaryManager = new SummaryManagerService(summaryRepo, summaryFileService, summarySyncService);

        const agentService = new AgentSessionService();

        // 创建归档服务和局域网同步服务
        const archiveService = new MobileArchiveService(pathService, vaultService);
        const lanSyncService = new MobileLanSyncService(archiveService);
        const cloudSyncService = new MobileCloudSyncService(archiveService);

        const toolRegistry = new ToolRegistry();
        const registry = AIProviderRegistry.getInstance();
        registry.initializeDefaultProviders();

        // 日记全文搜索器（与桌面端 createDiarySearcher 对齐）
        const diarySearcher = {
          async searchFTS(query: string, limit?: number) {
            const results = await shadowRepo.searchFTS(query, limit);
            const allRecords = await shadowRepo.getAllRecords();
            const idToDateMap = new Map(allRecords.map(r => [r.id, r.date]));
            return results.map(r => ({
              date: idToDateMap.get(r.rowid) || '',
              contentSnippet: r.contentSnippet,
              tags: r.tags,
              rankScore: r.rankScore,
            }));
          },
        };

        const startAgentChat = async (
          sessionId: string,
          userText: string,
          callbacks: StreamChatCallbacks,
          overrides?: { providerId?: string; modelId?: string; searchMode?: boolean },
        ) => {
          try {
            const providers = await settingsManager.get<any[]>('ai_providers') || [];
            const globalModels = await settingsManager.get<any>('global_models');

            const providerId = overrides?.providerId || globalModels?.globalDialogueProviderId;
            const config = providers.find((p: any) => p.id === providerId) || providers.find((p: any) => p.isEnabled);

            if (!config) throw new Error('No active provider configured');

            const provider = registry.getOrUpdateProvider(config);

            // 读取搜索相关配置
            const searchMode = overrides?.searchMode ?? false;
            const webSearchConfig = await settingsManager.get<any>('web_search_config');
            const ragConfig = await settingsManager.get<any>('rag_config');

            const userConfig: Record<string, unknown> = {
              web_search_enabled: searchMode,
              web_search_engine: webSearchConfig?.webSearchEngine || 'duckduckgo',
              web_search_max_results: webSearchConfig?.webSearchMaxResults || 5,
              web_search_rag_enabled: webSearchConfig?.webSearchRagEnabled ?? true,
              tavily_api_key: webSearchConfig?.webSearchApiKey || '',
              ragEnabled: ragConfig?.ragEnabled ?? true,
            };

            const modelId = overrides?.modelId || globalModels?.globalDialogueModelId || config.defaultDialogueModel || config.models[0];

            await agentService.streamChat({
               sessionId,
               userText,
               provider,
               modelId,
               toolRegistry,
               sessionRepo,
               snapshotRepo,
               userConfig,
               diarySearcher,
               webSearchResultFetcher: webFetchContent,
               fetchSearchPage: fetchDuckDuckGoSearch,
            }, callbacks);
          } catch(e) {
            console.error('Mobile Agent Chat Failed:', e);
            throw e;
          }
        };

        console.log('Mobile DB and DI Container Ready!');

        if (isMounted) {
          setValue({
            dbReady: true,
            services: {
               agentService,
               sessionManager,
               diaryService,
               settingsManager,
               summaryManager,
               archiveService,
               lanSyncService,
               cloudSyncService
            },
            startAgentChat
          });
        }
      } catch (e) {
        console.error('Failed to init Baishou DB:', e);
      }
    }

    init();

    return () => { isMounted = false; };
  }, []);

  return (
    <BaishouContext.Provider value={value}>
      {children}
    </BaishouContext.Provider>
  );
}
