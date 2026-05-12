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
  startAgentChat?: (sessionId: string, userText: string, callbacks: StreamChatCallbacks, overrides?: { providerId?: string; modelId?: string }) => Promise<void>;
}

const BaishouContext = createContext<BaishouContextValue>({ dbReady: false, services: null });

export const useBaishou = () => useContext(BaishouContext);

export function BaishouProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<BaishouContextValue>({ dbReady: false, services: null });

  useEffect(() => {
    let isMounted = true;
    
    async function init() {
      try {
        // 1. 初始化 SQLite 环境
        const expoDb = await SQLite.openDatabaseAsync('baishou_next_mobile.db');
        
        // 尝试加载 SQLite Vec 扩展 (不强求，失败降级)
        try {
           // expoDb 可能不直接抛出 C 原生扩展，但保留这里作为未来 native 适配入口
           // 不使用 node 版本的 sqliteVec.load(expoDb)，而是留给底层 Repository 根据 isVecLoaded = false 自动降级处理！
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

        const agentService = new AgentSessionService(); // Phase 3

        // 创建归档服务和局域网同步服务
        const archiveService = new MobileArchiveService(pathService, vaultService);
        const lanSyncService = new MobileLanSyncService(archiveService);
        const cloudSyncService = new MobileCloudSyncService(archiveService);

        const toolRegistry = new ToolRegistry();
        const registry = AIProviderRegistry.getInstance();
        registry.initializeDefaultProviders();

        const startAgentChat = async (sessionId: string, userText: string, callbacks: StreamChatCallbacks, overrides?: { providerId?: string; modelId?: string }) => {
          try {
            const providers = await settingsManager.get<any[]>('ai_providers') || [];
            const globalModels = await settingsManager.get<any>('global_models');
            
            // 支持助手级模型覆盖，优先使用 overrides
            const providerId = overrides?.providerId || globalModels?.globalDialogueProviderId;
            const config = providers.find((p: any) => p.id === providerId) || providers.find((p: any) => p.isEnabled);
            
            if (!config) throw new Error('No active provider configured');
            
            // 使用刚引入的单例模式，避免移动端长时间存活导致的过期缓存问题
            const provider = registry.getOrUpdateProvider(config);
            
            await agentService.streamChat({
               sessionId,
               userText,
               provider,
               modelId: overrides?.modelId || globalModels?.globalDialogueModelId || config.defaultDialogueModel || config.models[0],
               toolRegistry,
               sessionRepo,
               snapshotRepo
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
