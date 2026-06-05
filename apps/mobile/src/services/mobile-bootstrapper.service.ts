import type {
  ShadowIndexSyncService,
  SessionManagerService,
  AssistantManagerService,
  SettingsManagerService,
  SummarySyncService
} from '@baishou/core-mobile'
import { logger } from '@baishou/shared'
import i18n from 'i18next'

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
    await this.runWhenVaultReady(this.registeredDeps, { force: true })
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

    logger.info('[MobileBootstrapper] Starting ecosystem resync…')

    try {
      await deps.shadowIndexSyncService.fullScanVault(true)

      try {
        await deps.summarySyncService.fullScanArchives()
      } catch (e) {
        logger.warn('[MobileBootstrapper] summary fullScanArchives failed:', e as Error)
      }

      try {
        await deps.assistantManager.fullResyncFromDisks()
      } catch (e) {
        logger.warn('[MobileBootstrapper] assistant fullResyncFromDisks failed:', e as Error)
      }

      try {
        await deps.sessionManager.fullResyncFromDisks()
      } catch (e) {
        logger.warn('[MobileBootstrapper] session fullResyncFromDisks failed:', e as Error)
      }

      try {
        await deps.settingsManager.fullResyncFromDisk()
      } catch (e) {
        logger.warn('[MobileBootstrapper] settings fullResyncFromDisk failed:', e as Error)
      }

      // Check and create default assistant
      const assistants = await deps.settingsManager.get<any[]>('assistants')
      if (!assistants || assistants.length === 0) {
        const defaultAssistant = {
          id: 'default',
          name: i18n.t('agent.assistant.default_assistant_name', '默认伙伴'),
          emoji: '🍵',
          isDefault: true,
          isPinned: false,
          systemPrompt: ''
        }
        await deps.settingsManager.set('assistants', [defaultAssistant])
        logger.info('[MobileBootstrapper] Created default assistant')
      }

      const userProfile = await deps.settingsManager.get<any>('user_profile')
      if (!userProfile || !userProfile.personas || Object.keys(userProfile.personas).length === 0) {
        const defaultPersonaId = i18n.t('settings.default_identity', '默认身份')
        const defaultProfile = {
          nickname: i18n.t('settings.default_nickname', '白守用户'),
          activePersonaId: defaultPersonaId,
          personas: {
            [defaultPersonaId]: { id: defaultPersonaId, facts: {} }
          },
          recentPersonaIds: [defaultPersonaId]
        }
        await deps.settingsManager.set('user_profile', defaultProfile)
        logger.info('[MobileBootstrapper] Created default identity card')
      }

      logger.info('[MobileBootstrapper] Ecosystem resync complete')
    } catch (e) {
      logger.error('[MobileBootstrapper] Resync failed:', e as Error)
    } finally {
      this.running = false
      this.resolveIdleWaiters()
    }
  }
}

export const mobileDataBootstrapper = new MobileDataBootstrapper()
