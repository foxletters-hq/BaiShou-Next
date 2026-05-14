import {
  ShadowIndexSyncService,
  SummarySyncService,
  SummaryFileService
} from '@baishou/core';
import {
  ShadowIndexRepository,
  SummaryRepositoryImpl,
  connectionManager,
  shadowConnectionManager
} from '@baishou/database';
import { logger } from '@baishou/shared';

import { pathService, vaultService } from '../ipc/vault.ipc';
import { getAgentManagers } from '../ipc/agent.ipc';
import { settingsManager } from '../ipc/settings.ipc';
import { getGitService } from '../ipc/git-sync.ipc';
import { diaryWatcher } from './diary-watcher.service';
import { summaryWatcher } from './summary-watcher.service';
import { sessionWatcher } from './session-watcher.service';

/**
 * 全局数据同步收割机 (Global Bootstrapper)
 *
 * 在系统开机、网盘刚拉取、Zip 包解压后、或 Vault 切换后调用。
 * 其目的是跨过脱水的文件，执行一遍"水合作用"，
 * 让所有的 Markdown 和 JSON 强行对齐进 SQLite 的高性能索引和状态里。
 *
 * 双库分离架构：
 * - 影子索引（日记）→ shadowConnectionManager.getDb()（per-vault shadow_index.db）
 * - Agent/Summary → connectionManager.getDb()（全局 baishou_agent.db）
 */
export class GlobalDataBootstrapper {

  private tryGetSummaryBootstrapper() {
    const db = connectionManager.getDb();
    const summaryRepo = new SummaryRepositoryImpl(db);
    const summaryFileService = new SummaryFileService(pathService);
    return new SummarySyncService(null, null, summaryRepo, summaryFileService);
  }

  /**
   * 影子索引同步服务工厂
   * 从 shadowConnectionManager 获取当前 Vault 的 Shadow DB 实例
   */
  private tryGetShadowBootstrapper() {
    const shadowDb = shadowConnectionManager.getDb(); // per-vault shadow_index.db
    const shadowRepo = new ShadowIndexRepository(shadowDb);
    return new ShadowIndexSyncService(shadowRepo, pathService, vaultService);
  }

  /**
   * 将所有的漫游明文资产猛烈拍进本地缓存中
   * 必须在确保 Shadow DB 已连接（shadowConnectionManager.connect() 已调用）的状态下执行。
   */
  async fullyResyncAllEcosystems(): Promise<void> {
    logger.info('--- 🌊 GLOBAL BOOTSTRAPPER TRIGGERED. INITIATING ECOSYSTEM SSOT WATER-CYCLE ---');

    try {
      const activeVault = vaultService.getActiveVault();
      logger.info(`[Bootstrapper] 正在尝试启动监听。activeVault:`, activeVault);
      if (activeVault) {
        // 自动初始化 Git 仓库（如果尚未初始化）
        try {
          const gitService = getGitService();
          const initialized = await gitService.isInitialized();
          if (!initialized) {
            await gitService.init();
            logger.info('[Bootstrapper] Git 仓库已自动初始化');
          }
        } catch (e) {
          logger.warn('[Bootstrapper] Git 自动初始化失败:', e as any);
        }

        diaryWatcher.start(activeVault.path);
        summaryWatcher.start(activeVault.path);
        sessionWatcher.start(activeVault.path);
      } else {
        logger.warn(`[Bootstrapper] ⚠️ 发现 activeVault 为空！`);
      }

      const shadowScout = this.tryGetShadowBootstrapper();
      const summaryScout = this.tryGetSummaryBootstrapper();
      const { sessionManager, assistantManager } = getAgentManagers();

      // 1. 日记层：从 shadow_index.db 同步影子索引（最海量的数据）
      logger.info('[Bootstrapper] 正在同步核心日记 (Diary Shadow Index)...');
      await shadowScout.fullScanVault(true);

      // 2. 总结层：从 baishou_agent.db 同步 Summary 存档
      logger.info('[Bootstrapper] 正在同步阶段总结 (Summary Archives)...');
      await summaryScout.fullScanArchives();

      // 3. AI 预设角色：从 baishou_agent.db 同步助手配置
      logger.info('[Bootstrapper] 正在同步助理设定 (Assistant Assets)...');
      await assistantManager.fullResyncFromDisks();

      // 4. AI 漫游会话：从 baishou_agent.db 同步会话快照
      logger.info('[Bootstrapper] 正在同步智能体对话上下文 (Agent Session Snapshots)...');
      await sessionManager.fullResyncFromDisks();

      // 5. 应用设置
      logger.info('[Bootstrapper] 正在同步用户级全局设定 (Settings Blueprint)...');
      await settingsManager.fullResyncFromDisk();

      logger.info('--- ✅ GLOBAL BOOTSTRAPPER FINISHED. SYSTEM IS RATIONALIZED AND READY ---');
    } catch (e) {
      logger.error('--- ❌ GLOBAL BOOTSTRAPPER FAILED. SEVERE SYNCHRONIZATION ERROR ---', e);
    }
  }
}

export const globalBootstrapper = new GlobalDataBootstrapper();
