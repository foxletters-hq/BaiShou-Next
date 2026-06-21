import { BrowserWindow } from 'electron'
import { logger } from '@baishou/shared'

let backgroundResyncInFlight: Promise<void> | null = null

function broadcastDiarySyncEvent(event: Record<string, unknown>): void {
  BrowserWindow.getAllWindows().forEach((w) => {
    w.webContents.send('diary:sync-event', event)
  })
}

/** 等待当前进行中的 vault 全量 resync（无进行中任务则立即 resolve） */
export function waitForVaultEcosystemResync(): Promise<void> {
  return backgroundResyncInFlight ?? Promise.resolve()
}

export function isVaultEcosystemResyncInFlight(): boolean {
  return backgroundResyncInFlight !== null
}

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
  broadcastDiarySyncEvent({ type: 'indexing-started', reason })

  backgroundResyncInFlight = import('./bootstrapper.service')
    .then(({ globalBootstrapper }) => globalBootstrapper.fullyResyncAllEcosystems())
    .catch((e) => {
      logger.error(`[VaultResync] Background resync failed (${reason}):`, e as any)
    })
    .finally(async () => {
      backgroundResyncInFlight = null
    })

  return backgroundResyncInFlight
}
