import type {
  ShadowIndexSyncService,
  SessionManagerService,
  AssistantManagerService,
  SettingsManagerService,
  SummarySyncService
} from '@baishou/core-mobile'
import { logger } from '@baishou/shared'

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

  registerDeps(deps: MobileBootstrapperDeps): void {
    this.registeredDeps = deps
  }

  async resyncFromDisk(): Promise<void> {
    if (!this.registeredDeps) return
    await this.runWhenVaultReady(this.registeredDeps)
  }

  async runWhenVaultReady(deps: MobileBootstrapperDeps): Promise<void> {
    this.registeredDeps = deps
    if (this.running) {
      logger.info('[MobileBootstrapper] Already running, skip duplicate call')
      return
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

      await deps.assistantManager.fullResyncFromDisks()
      await deps.sessionManager.fullResyncFromDisks()
      await deps.settingsManager.fullResyncFromDisk()

      logger.info('[MobileBootstrapper] Ecosystem resync complete')
    } catch (e) {
      logger.error('[MobileBootstrapper] Resync failed:', e as Error)
    } finally {
      this.running = false
    }
  }
}

export const mobileDataBootstrapper = new MobileDataBootstrapper()
