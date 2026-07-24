import { BrowserWindow } from 'electron'
import { logger } from '@baishou/shared'
import { markStartup, startupElapsedMs, traceStartupStep } from '../startup-trace.util'

let backgroundResyncInFlight: Promise<void> | null = null

/** 冷启动全量扫盘：等首屏后再跑，避免与 Vite/渲染进程抢 CPU */
let coldStartArmed = false
let coldStartReleased = false
let coldStartFallbackTimer: ReturnType<typeof setTimeout> | null = null

const COLD_START_FALLBACK_MS = 30_000

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

function clearColdStartFallbackTimer(): void {
  if (coldStartFallbackTimer) {
    clearTimeout(coldStartFallbackTimer)
    coldStartFallbackTimer = null
  }
}

/**
 * 冷启动时武装延后扫盘：不立刻 fullScan，等首屏或超时后再 release。
 */
export function armDeferredColdStartResync(): void {
  if (coldStartArmed || coldStartReleased) {
    markStartup('vaultResync.coldStart.arm-skip', {
      armed: coldStartArmed,
      released: coldStartReleased
    })
    return
  }

  coldStartArmed = true
  markStartup('vaultResync.coldStart.armed', { fallbackMs: COLD_START_FALLBACK_MS })
  logger.info(
    `[VaultResync] Cold-start resync deferred until first paint (fallback ${COLD_START_FALLBACK_MS}ms)`
  )

  clearColdStartFallbackTimer()
  coldStartFallbackTimer = setTimeout(() => {
    coldStartFallbackTimer = null
    releaseDeferredColdStartResync('fallback-timeout')
  }, COLD_START_FALLBACK_MS)
}

/**
 * 首屏就绪后释放冷启动扫盘（幂等）。
 */
export function releaseDeferredColdStartResync(trigger: string): boolean {
  if (coldStartReleased) {
    markStartup('vaultResync.coldStart.release-skip', { trigger })
    return false
  }
  if (!coldStartArmed) {
    markStartup('vaultResync.coldStart.release-unarmed', { trigger })
    return false
  }

  coldStartReleased = true
  clearColdStartFallbackTimer()
  markStartup('vaultResync.coldStart.released', { trigger })
  logger.info(`[VaultResync] Releasing deferred cold-start resync (${trigger})`)
  void scheduleVaultEcosystemResync(`cold-start:${trigger}`)
  return true
}

/**
 * Run full ecosystem resync in the background (deduped).
 * Used after vault switch so IPC can return before disk scans finish.
 */
export function scheduleVaultEcosystemResync(reason: string): Promise<void> {
  if (backgroundResyncInFlight) {
    logger.info(`[VaultResync] Reusing in-flight resync (requested: ${reason})`)
    markStartup('vaultResync.reuse', { reason })
    return backgroundResyncInFlight
  }

  logger.info(`[VaultResync] Scheduling background resync: ${reason}`)
  markStartup('vaultResync.schedule', { reason })
  broadcastDiarySyncEvent({ type: 'indexing-started', reason })

  const mode = reason.startsWith('cold-start') ? 'reconcile' : 'full'
  markStartup('vaultResync.mode', { reason, mode })
  logger.info(`[VaultResync] Bootstrap mode=${mode} (reason=${reason})`)

  const scheduledAt = performance.now()
  backgroundResyncInFlight = import('./bootstrapper.service')
    .then(({ globalBootstrapper }) =>
      traceStartupStep(`vaultResync.fullyResync(${reason})`, () =>
        globalBootstrapper.fullyResyncAllEcosystems({ mode })
      )
    )
    .catch((e) => {
      logger.error(`[VaultResync] Background resync failed (${reason}):`, e as any)
    })
    .finally(async () => {
      markStartup('vaultResync.finished', {
        reason,
        ms: startupElapsedMs(scheduledAt)
      })
      backgroundResyncInFlight = null
      // 冷启动/对齐结束后尝试消化嵌入欠账（受「联网自动恢复」开关约束）
      void import('./diary-embed-jobs-consumer.service').then(({ scheduleConsumeDiaryEmbedJobs }) => {
        scheduleConsumeDiaryEmbedJobs(`after-resync:${reason}`)
      })
    })

  return backgroundResyncInFlight
}
