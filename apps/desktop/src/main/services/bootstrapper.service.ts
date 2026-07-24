import { BrowserWindow } from 'electron'
import {
  SummarySyncService,
  SummaryFileService,
  listDiskVaultFolderNames
} from '@baishou/core-desktop'
import { SummaryRepositoryImpl, connectionManager } from '@baishou/database-desktop'
import { app } from 'electron'
import * as path from 'path'
import { ensureDefaultLatteAssistant } from '@baishou/core-desktop'
import { isUsingExternalVaultDirectory, logger, resolveBootstrapUiLocale } from '@baishou/shared'

import { pathService, vaultService } from '../ipc/vault.ipc'
import { fileSystem } from './node-file-system'
import { getAgentManagers } from '../ipc/agent.ipc'
import { settingsManager } from '../ipc/settings.ipc'
import { getGitService } from '../ipc/git-sync.ipc'
import { diaryWatcher } from './diary-watcher.service'
import { summaryWatcher } from './summary-watcher.service'
import { sessionWatcher } from './session-watcher.service'
import { getSharedShadowSync } from './shadow-sync.registry'
import { getRawDataSourceManager, runDerivedIndexHydration } from './raw-data-source.runtime'
import { markStartup, startupElapsedMs, traceStartupStep } from '../startup-trace.util'

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
    const summaryFileService = new SummaryFileService(
      pathService,
      fileSystem,
      getRawDataSourceManager()
    )
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
      await traceStartupStep('git.ensureInitialized', async () => {
        const gitService = getGitService()
        const initialized = await gitService.isInitialized()
        if (!initialized) {
          await gitService.init()
          logger.info('[Bootstrapper] Git 仓库已自动初始化')
        }
      })
    } catch (e) {
      logger.warn('[Bootstrapper] Git 自动初始化失败:', e as any)
    }

    const journalsDir = await pathService.getJournalsBaseDirectory()
    const summariesDir = await pathService.getSummariesBaseDirectory()
    const vaultDir = await pathService.getVaultDirectory(activeVault.name)
    const externalJournals = await pathService.getExternalJournalsDirectory(activeVault.name)
    const externalSummaries = await pathService.getExternalSummariesDirectory(activeVault.name)
    const defaultJournalsDir = path.join(vaultDir, 'Journals')
    const defaultSummariesDir = path.join(vaultDir, 'Archives')
    const isExternalJournals = isUsingExternalVaultDirectory(
      externalJournals,
      journalsDir,
      defaultJournalsDir
    )
    const isExternalSummaries = isUsingExternalVaultDirectory(
      externalSummaries,
      summariesDir,
      defaultSummariesDir
    )

    diaryWatcher.start(journalsDir, { createIfMissing: !isExternalJournals })
    summaryWatcher.start(summariesDir, activeVault.path, {
      createIfMissing: !isExternalSummaries
    })
    sessionWatcher.start(activeVault.path)
    markStartup('watchers.started', { vault: activeVault.name })
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
   *
   * @param options.mode `reconcile`：冷启动轻量对齐（session/summary 按 mtime 跳过未变文件）；
   *   `full`：vault 切换等场景的全量扫盘（默认，保持旧行为）。
   */
  async fullyResyncAllEcosystems(options?: { mode?: 'reconcile' | 'full' }): Promise<void> {
    const mode = options?.mode ?? 'full'
    logger.info(
      `--- 🌊 GLOBAL BOOTSTRAPPER TRIGGERED (mode=${mode}). INITIATING ECOSYSTEM SSOT WATER-CYCLE ---`
    )
    markStartup('resync.begin', { mode })
    const totalStarted = performance.now()

    try {
      await this.activateVaultRuntime()

      const shadowScout = this.tryGetShadowBootstrapper()
      const summaryScout = this.tryGetSummaryBootstrapper()
      const { sessionManager, assistantManager } = getAgentManagers()

      // 1. 日记层：从 shadow_index.db 同步影子索引（最海量的数据）
      logger.info('[Bootstrapper] 正在同步核心日记 (Diary Shadow Index)...')
      const timed = <T>(name: string, promise: Promise<T>): Promise<T> => {
        const started = performance.now()
        return promise.then(
          (value) => {
            markStartup(`resync.${name}`, { ms: startupElapsedMs(started) })
            return value
          },
          (error) => {
            markStartup(`resync.${name}.failed`, { ms: startupElapsedMs(started) })
            throw error
          }
        )
      }

      // Shadow：reconcile / full 均走 fullScanVault（mtime skip 由 syncJournalsBatch 侧承接）
      const shadowScan = timed('shadow.fullScanVault', shadowScout.fullScanVault(true))

      // 2–5. 其余层与日记扫描并行，缩短冷启动等待
      const activeVault = vaultService.getActiveVault()
      const summaryResyncOptions = {
        ...(activeVault ? { activeVaultName: activeVault.name } : {}),
        ...(mode === 'reconcile' ? { skipUnchangedByMtime: true } : {})
      }
      const syncRoot = await pathService.getRootDirectory()
      const diskVaultNames = await listDiskVaultFolderNames(fileSystem, syncRoot)
      const sessionResyncOptions = {
        ...(activeVault ? { activeVaultName: activeVault.name } : {}),
        diskVaultNames
      }
      const summaryScan = timed(
        mode === 'reconcile' ? 'summary.fullScanArchives.reconcile' : 'summary.fullScanArchives',
        summaryScout.fullScanArchives(summaryResyncOptions)
      )
      const assistantScan = timed(
        'assistant.fullResyncFromDisks',
        assistantManager.fullResyncFromDisks()
      )
      const sessionScan = timed(
        mode === 'reconcile' ? 'session.reconcileFromDisks' : 'session.fullResyncFromDisks',
        mode === 'reconcile'
          ? sessionManager.reconcileFromDisks(sessionResyncOptions)
          : sessionManager.fullResyncFromDisks(sessionResyncOptions)
      )
      const settingsScan = timed(
        'settings.fullResyncFromDisk',
        settingsManager.fullResyncFromDisk()
      )

      await traceStartupStep('resync.parallelScans', () =>
        Promise.all([shadowScan, summaryScan, assistantScan, sessionScan, settingsScan])
      )
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
      await pathService.mirrorGlobalAgentAvatarsIntoVaults()

      await traceStartupStep('resync.derivedIndexHydration', () =>
        runDerivedIndexHydration('fully-resync')
      )

      logger.info('--- ✅ GLOBAL BOOTSTRAPPER FINISHED. SYSTEM IS RATIONALIZED AND READY ---')
      markStartup('resync.total', { ms: startupElapsedMs(totalStarted) })
      await this.notifyRenderersAfterResync()
    } catch (e) {
      logger.error('--- ❌ GLOBAL BOOTSTRAPPER FAILED. SEVERE SYNCHRONIZATION ERROR ---', e as any)
      markStartup('resync.failed', { ms: startupElapsedMs(totalStarted) })
    }
  }

  /**
   * 增量同步后按需索引：只扫触及层，settings 以盘为准灌库且不反写。
   * 禁止无条件 fullyResync（会写盘改 hash，导致下次又提示上传）。
   */
  async selectiveResyncAfterIncrementalSync(options: {
    journals?: boolean
    summaries?: boolean
    assistants?: boolean
    settings?: boolean
    sessions?: boolean
    /** 不跑 Latte/头像 mirror 等可能写盘的收尾 */
    skipEnsures?: boolean
  }): Promise<void> {
    const needsAny =
      options.journals ||
      options.summaries ||
      options.assistants ||
      options.settings ||
      options.sessions
    if (!needsAny) {
      logger.info('[Bootstrapper] selective post-sync: nothing to index')
      return
    }

    logger.info('[Bootstrapper] selective post-sync start', options)
    try {
      const shadowScout = this.tryGetShadowBootstrapper()
      const summaryScout = this.tryGetSummaryBootstrapper()
      const { sessionManager, assistantManager } = getAgentManagers()
      const activeVault = vaultService.getActiveVault()
      const syncRoot = await pathService.getRootDirectory()
      const diskVaultNames = await listDiskVaultFolderNames(fileSystem, syncRoot)
      const resyncOptions = {
        ...(activeVault ? { activeVaultName: activeVault.name } : {}),
        diskVaultNames
      }

      const tasks: Promise<unknown>[] = []
      if (options.journals) {
        tasks.push(
          shadowScout.fullScanVault(true).catch((e) => {
            logger.warn('[Bootstrapper] selective shadow scan failed:', e as Error)
          })
        )
      }
      if (options.summaries) {
        tasks.push(
          summaryScout
            .fullScanArchives(activeVault ? { activeVaultName: activeVault.name } : undefined)
            .catch((e) => {
              logger.warn('[Bootstrapper] selective summary scan failed:', e as Error)
            })
        )
      }
      if (options.assistants) {
        tasks.push(
          assistantManager.fullResyncFromDisks(resyncOptions).catch((e) => {
            logger.warn('[Bootstrapper] selective assistant scan failed:', e as Error)
          })
        )
      }
      if (options.sessions) {
        // 会话定点水合已在 IPC 层做；此处仅在需要时 fullScan（例如大量删除）
        tasks.push(
          sessionManager.fullResyncFromDisks(resyncOptions).catch((e) => {
            logger.warn('[Bootstrapper] selective session scan failed:', e as Error)
          })
        )
      }
      if (options.settings) {
        tasks.push(
          settingsManager.fullResyncFromDisk({ diskAuthoritative: true }).catch((e) => {
            logger.warn('[Bootstrapper] selective settings scan failed:', e as Error)
          })
        )
      }
      if (tasks.length > 0) await Promise.all(tasks)

      if (!options.skipEnsures) {
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
        }
        await pathService.backfillGlobalAgentAvatarsFromVaults()
        await pathService.mirrorGlobalAgentAvatarsIntoVaults()
      }

      await runDerivedIndexHydration('selective-post-sync')

      await this.notifyRenderersAfterResync()
      logger.info('[Bootstrapper] selective post-sync done')
    } catch (e) {
      logger.error('[Bootstrapper] selective post-sync failed:', e as Error)
    }
  }
}

export const globalBootstrapper = new GlobalDataBootstrapper()
