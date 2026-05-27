import { logger } from '@baishou/shared'

let backgroundResyncInFlight: Promise<void> | null = null

/**
 * Run full ecosystem resync in the background (deduped).
 * Used after vault switch so IPC can return before disk scans finish.
 */
export function scheduleVaultEcosystemResync(reason: string): Promise<void> {
  if (backgroundResyncInFlight) {
    logger.info(`[VaultResync] Reusing in-flight resync (requested: ${reason})`)
    return backgroundResyncInFlight
  }

  logger.info(`[VaultResync] Scheduling background resync: ${reason}`)
  backgroundResyncInFlight = import('./bootstrapper.service')
    .then(({ globalBootstrapper }) => globalBootstrapper.fullyResyncAllEcosystems())
    .catch((e) => {
      logger.error(`[VaultResync] Background resync failed (${reason}):`, e as any)
    })
    .finally(() => {
      backgroundResyncInFlight = null
    })

  return backgroundResyncInFlight
}
