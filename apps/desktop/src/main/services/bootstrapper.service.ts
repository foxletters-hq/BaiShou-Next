import {
  ShadowIndexSyncService, 
  SummarySyncService, 
  SummaryFileService
} from '@baishou/core';
import { 
  ShadowIndexRepository, 
  SummaryRepositoryImpl,
  connectionManager
} from '@baishou/database';

import { pathService, vaultService } from '../ipc/vault.ipc';
import { getAgentManagers } from '../ipc/agent.ipc';
import { settingsManager } from '../ipc/settings.ipc';

/**
 * 全局数据同步收割机 (Global Bootstrapper)
 * 在系统开机、网盘刚拉取、或 Zip 包解压后调用。
 * 其目的是跨过脱水的文件，执行一遍“水合作用”，让所有的 Markdown 和 JSON 强行对齐进 SQLite 的高性能索引和状态里！
 */
export class GlobalDataBootstrapper {
  
  private tryGetSummaryBootstrapper() {
     const db = connectionManager.getDb();
     const summaryRepo = new SummaryRepositoryImpl(db);
     const summaryFileService = new SummaryFileService(pathService);
     return new SummarySyncService({} as any, {} as any, summaryRepo, summaryFileService);
  }

  private tryGetShadowBootstrapper() {
     const db = connectionManager.getDb();
     const shadowRepo = new ShadowIndexRepository(db);
     return new ShadowIndexSyncService(shadowRepo, pathService, vaultService);
  }

  /**
   * 将所有的漫游明文资产猛烈拍进本地缓存中
   * 必须在确保 SQLite 处于挂载状态下执行。
   */
  async fullyResyncAllEcosystems(): Promise<void> {
     console.log('--- 🌊 GLOBAL BOOTSTRAPPER TRIGGERED. INITIATING ECOSYSTEM SSOT WATER-CYCLE ---');

     try {
       const shadowScout = this.tryGetShadowBootstrapper();
       const summaryScout = this.tryGetSummaryBootstrapper();
       const { sessionManager, assistantManager } = getAgentManagers();

       // 1. 日记层: 最基础和海量的数据
       console.log('[Bootstrapper] 正在同步核心日记 (Diary Shadow Index)...');
       await shadowScout.fullScanVault(true);

       // 2. 总结层
       console.log('[Bootstrapper] 正在同步阶段总结 (Summary Archives)...');
       await summaryScout.fullScanArchives();

       // 3. AI 预设角色
       console.log('[Bootstrapper] 正在同步助理设定 (Assistant Assets)...');
       await assistantManager.fullResyncFromDisks();

       // 4. AI 漫游会话
       console.log('[Bootstrapper] 正在同步智能体对话上下文 (Agent Session Snapshots)...');
       await sessionManager.fullResyncFromDisks();

       // 5. 应用设置
       console.log('[Bootstrapper] 正在同步用户级全局设定 (Settings Blueprint)...');
       await settingsManager.fullResyncFromDisk();

       console.log('--- ✅ GLOBAL BOOTSTRAPPER FINISHED. SYSTEM IS RATIONALIZED AND READY ---');
     } catch (e) {
       console.error('--- ❌ GLOBAL BOOTSTRAPPER FAILED. SEVERE SYNCHRONIZATION ERROR ---', e);
     }
  }
}

export const globalBootstrapper = new GlobalDataBootstrapper();
