import { logger } from '@baishou/shared'
import { mobileDataBootstrapper, type MobileBootstrapperDeps } from './mobile-bootstrapper.service'

let backgroundResyncInFlight: Promise<void> | null = null

export function waitForVaultEcosystemResync(): Promise<void> {
  return backgroundResyncInFlight ?? Promise.resolve()
}

/**
 * 后台全量 resync（对齐 Desktop scheduleVaultEcosystemResync）。
 * Vault 切换时只做 connect + watcher，磁盘扫描放后台，缩短 Shadow DB 切换窗口。
 */
export function scheduleVaultEcosystemResync(
  deps: MobileBootstrapperDeps,
  reason: string,
  onComplete?: () => void
): Promise<void> {
  if (backgroundResyncInFlight) {
    logger.info(`[MobileVaultResync] Reusing in-flight resync (requested: ${reason})`)
    return backgroundResyncInFlight
  }

  logger.info(`[MobileVaultResync] Scheduling background resync: ${reason}`)
  mobileDataBootstrapper.registerDeps(deps)

  backgroundResyncInFlight = mobileDataBootstrapper
    .runWhenVaultReady(deps, { force: true })
    .catch((e) => {
      logger.error(`[MobileVaultResync] Background resync failed (${reason}):`, e as Error)
    })
    .finally(() => {
      backgroundResyncInFlight = null
      onComplete?.()
    })

  return backgroundResyncInFlight
}
