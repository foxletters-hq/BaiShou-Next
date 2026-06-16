import type {
  ShadowIndexSyncService,
  SessionManagerService,
  AssistantManagerService,
  SettingsManagerService,
  SummarySyncService
} from '@baishou/core-mobile'
import { ensureDefaultLatteAssistant } from '@baishou/core-mobile'
import { logger, DEFAULT_USER_PROFILE, USER_PROFILE_SETTINGS_KEY } from '@baishou/shared'
import { resolveMobileBootstrapUiLocale } from '../lib/onboarding-language.util'

export type MobileBootstrapperStatus = 'idle' | 'running'

export interface MobileBootstrapperDeps {
  shadowIndexSyncService: ShadowIndexSyncService
  sessionManager: SessionManagerService
  assistantManager: AssistantManagerService
  settingsManager: SettingsManagerService
  summarySyncService: SummarySyncService
}

/**
 * Mobile equivalent of desktop GlobalDataBootstrapper:
 * hydrate SQLite from on-disk Markdown/JSON after vault is ready.
 */
export class MobileDataBootstrapper {
  private running = false
  private registeredDeps: MobileBootstrapperDeps | null = null
  private idleWaiters: Array<() => void> = []
  private listeners = new Set<(status: MobileBootstrapperStatus) => void>()

  getStatus(): MobileBootstrapperStatus {
    return this.running ? 'running' : 'idle'
  }

  subscribe(listener: (status: MobileBootstrapperStatus) => void): () => void {
    this.listeners.add(listener)
    listener(this.getStatus())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emitStatus(): void {
    const status = this.getStatus()
    for (const listener of this.listeners) {
      listener(status)
    }
  }

  registerDeps(deps: MobileBootstrapperDeps): void {
    this.registeredDeps = deps
  }

  async waitUntilIdle(): Promise<void> {
    if (!this.running) return
    await new Promise<void>((resolve) => {
      this.idleWaiters.push(resolve)
    })
  }

  private resolveIdleWaiters(): void {
    const waiters = this.idleWaiters
    this.idleWaiters = []
    for (const resolve of waiters) {
      resolve()
    }
  }

  async resyncFromDisk(): Promise<void> {
    if (!this.registeredDeps) return
    const { waitForVaultEcosystemResync, scheduleVaultEcosystemResync } = await import(
      '../services/mobile-vault-resync.service'
    )
    // 等待进行中的 resync 结束，再强制跑一轮，避免复用 sync 前已启动的冷启动扫描
    await waitForVaultEcosystemResync()
    await scheduleVaultEcosystemResync(this.registeredDeps, 'resync-from-disk')
  }

  async runWhenVaultReady(
    deps: MobileBootstrapperDeps,
    options?: { force?: boolean }
  ): Promise<void> {
    this.registeredDeps = deps
    if (this.running) {
      if (options?.force) {
        await this.waitUntilIdle()
      } else {
        logger.info('[MobileBootstrapper] Already running, skip duplicate call')
        return
      }
    }
    this.running = true
    this.emitStatus()

    logger.info('[MobileBootstrapper] Starting ecosystem resync…')

    try {
      const shadowScan = deps.shadowIndexSyncService.fullScanVault(true).catch((e) => {
        logger.warn('[MobileBootstrapper] shadow fullScanVault failed:', e as Error)
      })

      const summaryScan = deps.summarySyncService.fullScanArchives().catch((e) => {
        logger.warn('[MobileBootstrapper] summary fullScanArchives failed:', e as Error)
      })

      const assistantScan = deps.assistantManager.fullResyncFromDisks().catch((e) => {
        logger.warn('[MobileBootstrapper] assistant fullResyncFromDisks failed:', e as Error)
      })

      const sessionScan = deps.sessionManager.fullResyncFromDisks().catch((e) => {
        logger.warn('[MobileBootstrapper] session fullResyncFromDisks failed:', e as Error)
      })

      const settingsScan = deps.settingsManager.fullResyncFromDisk().catch((e) => {
        logger.warn('[MobileBootstrapper] settings fullResyncFromDisk failed:', e as Error)
      })

      await Promise.all([shadowScan, summaryScan, assistantScan, sessionScan, settingsScan])

      const settings = (await deps.settingsManager.get<{ language?: string }>('settings')) || {}
      const locale = await resolveMobileBootstrapUiLocale(settings.language)
      if (locale) {
        await ensureDefaultLatteAssistant(deps.assistantManager, locale)
        logger.info('[MobileBootstrapper] Ensured default assistant Latte')
      } else {
        logger.info('[MobileBootstrapper] Skipped Latte until onboarding language is chosen')
      }

      const userProfile =
        await deps.settingsManager.get<typeof DEFAULT_USER_PROFILE>(USER_PROFILE_SETTINGS_KEY)
      if (!userProfile?.personas || Object.keys(userProfile.personas).length === 0) {
        await deps.settingsManager.set(USER_PROFILE_SETTINGS_KEY, DEFAULT_USER_PROFILE)
        logger.info('[MobileBootstrapper] Created default identity card')
      }

      logger.info('[MobileBootstrapper] Ecosystem resync complete')
    } catch (e) {
      logger.error('[MobileBootstrapper] Resync failed:', e as Error)
    } finally {
      this.running = false
      this.emitStatus()
      this.resolveIdleWaiters()
    }
  }
}

export const mobileDataBootstrapper = new MobileDataBootstrapper()
