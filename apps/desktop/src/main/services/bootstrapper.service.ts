import { BrowserWindow } from 'electron'
import { SummarySyncService, SummaryFileService } from '@baishou/core-desktop'
import { SummaryRepositoryImpl, connectionManager } from '@baishou/database-desktop'
import { app } from 'electron'
import { ensureDefaultLatteAssistant } from '@baishou/core-desktop'
import { logger, resolveBootstrapUiLocale } from '@baishou/shared'

import { pathService, vaultService } from '../ipc/vault.ipc'
import { fileSystem } from './node-file-system'
import { getAgentManagers } from '../ipc/agent.ipc'
import { settingsManager } from '../ipc/settings.ipc'
import { getGitService } from '../ipc/git-sync.ipc'
import { diaryWatcher } from './diary-watcher.service'
import { summaryWatcher } from './summary-watcher.service'
import { sessionWatcher } from './session-watcher.service'
import { getSharedShadowSync } from './shadow-sync.registry'

/**
 * 全局数据同步收割机 (Global Bootstrapper)
 *
 * 在系统开机、网盘刚拉取、Zip 包解压后、或 Vault 切换后调用。
 * 其目的是跨过脱水的文件，执行一遍"水合作用"，
 * 让所有的 Markdown 和 JSON 强行对齐进 SQLite 的高性能索引和状态里。
 *
 * 双库分离架构：
 * - 影子索引（日记）→ shadowConnectionManager.getDb()（全局 shadow_index_v2.db，按 vault_name 隔离）
 * - Agent/Summary → connectionManager.getDb()（全局 baishou_agent.db）
 */
export class GlobalDataBootstrapper {
  private tryGetSummaryBootstrapper() {
    const db = connectionManager.getDb()
    const summaryRepo = new SummaryRepositoryImpl(db)
    const summaryFileService = new SummaryFileService(pathService, fileSystem)
    return new SummarySyncService(null, null, summaryRepo, summaryFileService)
  }

  /**
   * 影子索引同步服务工厂（全局单例，与 watcher / IPC 共用扫描状态）
   */
  private tryGetShadowBootstrapper() {
    return getSharedShadowSync()
  }

  /**
   * 切换 Vault 后的轻量激活：文件监听 + Git 检查（不扫盘）。
   * 必须在 Shadow DB 已 connect 之后调用。
   */
  async activateVaultRuntime(): Promise<void> {
    const activeVault = vaultService.getActiveVault()
    if (!activeVault) {
      logger.warn('[Bootstrapper] activateVaultRuntime: activeVault is empty')
      return
    }

    try {
      const gitService = getGitService()
      const initialized = await gitService.isInitialized()
      if (!initialized) {
        await gitService.init()
        logger.info('[Bootstrapper] Git 仓库已自动初始化')
      }
    } catch (e) {
      logger.warn('[Bootstrapper] Git 自动初始化失败:', e as any)
    }

    diaryWatcher.start(await pathService.getJournalsBaseDirectory())
    summaryWatcher.start(
      await pathService.getSummariesBaseDirectory(),
      activeVault.path
    )
    sessionWatcher.start(activeVault.path)
  }

  private async notifyRenderersAfterResync(): Promise<void> {
    const { emitSyncMutation } = await import('../cache/desktop-main-cache-coordinator')
    emitSyncMutation('resync-complete', 'global-bootstrapper')
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send('session:file-changed')
      w.webContents.send('diary:sync-event', { type: 'vault-resync-complete' })
      w.webContents.send('diary:sync-event', { type: 'indexing-complete' })
    })
  }

  /**
   * 将所有的漫游明文资产猛烈拍进本地缓存中
   * 必须在确保 Shadow DB 已连接（shadowConnectionManager.connect() 已调用）的状态下执行。
   */
  async fullyResyncAllEcosystems(): Promise<void> {
    logger.info('--- 🌊 GLOBAL BOOTSTRAPPER TRIGGERED. INITIATING ECOSYSTEM SSOT WATER-CYCLE ---')

    try {
      await this.activateVaultRuntime()

      const shadowScout = this.tryGetShadowBootstrapper()
      const summaryScout = this.tryGetSummaryBootstrapper()
      const { sessionManager, assistantManager } = getAgentManagers()

      // 1. 日记层：从 shadow_index.db 同步影子索引（最海量的数据）
      logger.info('[Bootstrapper] 正在同步核心日记 (Diary Shadow Index)...')
      const shadowScan = shadowScout.fullScanVault(true)

      // 2–5. 其余层与日记扫描并行，缩短冷启动等待
      const activeVault = vaultService.getActiveVault()
      const summaryResyncOptions = activeVault ? { activeVaultName: activeVault.name } : undefined
      const summaryScan = summaryScout.fullScanArchives(summaryResyncOptions)
      const assistantScan = assistantManager.fullResyncFromDisks()
      const sessionScan = sessionManager.fullResyncFromDisks()
      const settingsScan = settingsManager.fullResyncFromDisk()

      await Promise.all([shadowScan, summaryScan, assistantScan, sessionScan, settingsScan])
      const appSettings = (await settingsManager.get<{ language?: string }>('settings')) || {}
      const featureSettings =
        (await settingsManager.get<{ language?: string }>('feature_settings')) || {}
      const storedLanguage = appSettings.language || featureSettings.language
      const locale = resolveBootstrapUiLocale({
        savedLanguage: storedLanguage,
        systemLocale: app.getLocale(),
        hasCompletedOnboarding: !!vaultService.getActiveVault()
      })
      if (locale) {
        await ensureDefaultLatteAssistant(assistantManager, locale)
      } else {
        logger.info('[Bootstrapper] Skipped Latte until UI language is chosen')
      }

      await pathService.backfillGlobalAgentAvatarsFromVaults()

      logger.info('--- ✅ GLOBAL BOOTSTRAPPER FINISHED. SYSTEM IS RATIONALIZED AND READY ---')
      await this.notifyRenderersAfterResync()
    } catch (e) {
      logger.error('--- ❌ GLOBAL BOOTSTRAPPER FAILED. SEVERE SYNCHRONIZATION ERROR ---', e as any)
    }
  }
}

export const globalBootstrapper = new GlobalDataBootstrapper()
