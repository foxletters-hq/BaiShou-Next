import { AppState, type AppStateStatus } from 'react-native'
import type { SummarySyncService } from '@baishou/core-mobile'
import {
  isExpoSqliteNativeUnavailableError,
  isSqliteDatabaseLockedError,
  waitForExpoAgentDatabaseIdle
} from '@baishou/database'
import { logger } from '@baishou/shared'
import { appendDiagnosticBreadcrumb } from './mobile-diagnostic-log.service'

function looksLikeAgentDatabaseDead(error: unknown): boolean {
  if (isSqliteDatabaseLockedError(error)) return false
  if (isExpoSqliteNativeUnavailableError(error)) return true
  const text = `${String((error as Error)?.message ?? '')}\n${String(error)}`.toLowerCase()
  return (
    text.includes('nullpointerexception') ||
    text.includes('nativedatabase.execasync') ||
    text.includes('nativedatabase.preparesync')
  )
}

/**
 * 定期触发总结文件全量扫描（对齐桌面 summary-watcher 的 debounced fullScan）。
 */
export class SummaryFileWatcherService {
  private timer: ReturnType<typeof setInterval> | null = null
  private appStateSub: { remove: () => void } | null = null
  private summarySync: SummarySyncService | null = null
  private tickInFlight = false
  private generation = 0
  private pausedForDeadDb = false
  private unavailableLoggedForGeneration = -1

  start(summarySync: SummarySyncService) {
    this.stopTimerOnly()
    this.generation += 1
    this.pausedForDeadDb = false
    this.unavailableLoggedForGeneration = -1
    this.summarySync = summarySync
    this.appStateSub?.remove()
    this.appStateSub = AppState.addEventListener('change', this.onAppState)
    this.timer = setInterval(() => void this.tick(), 15000)
    logger.info('[SummaryFileWatcher] started')
  }

  stop() {
    this.generation += 1
    this.pausedForDeadDb = false
    this.stopTimerOnly()
    this.appStateSub?.remove()
    this.appStateSub = null
    this.summarySync = null
  }

  private stopTimerOnly() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private pauseAfterDeadDatabase(error: unknown, generation: number) {
    if (this.unavailableLoggedForGeneration !== generation) {
      this.unavailableLoggedForGeneration = generation
      logger.warn(
        '[SummaryFileWatcher] agent database unavailable; paused until watcher restarts',
        error as Error
      )
      appendDiagnosticBreadcrumb(
        '[SummaryFileWatcher] paused: agent database unavailable (NativeDatabase NPE)'
      )
    }
    this.pausedForDeadDb = true
    this.stopTimerOnly()
  }

  getGeneration(): number {
    return this.generation
  }

  async waitUntilIdle(): Promise<void> {
    while (this.tickInFlight) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  private onAppState = (state: AppStateStatus) => {
    if (state !== 'active') return
    if (this.pausedForDeadDb || !this.summarySync) return
    void this.tick()
  }

  private async tick() {
    const generation = this.generation
    const summarySync = this.summarySync
    if (
      !summarySync ||
      AppState.currentState !== 'active' ||
      this.tickInFlight ||
      this.pausedForDeadDb
    )
      return
    this.tickInFlight = true
    try {
      await waitForExpoAgentDatabaseIdle()
      if (
        generation !== this.generation ||
        this.summarySync !== summarySync ||
        this.pausedForDeadDb
      )
        return
      await summarySync.fullScanArchives()
    } catch (e) {
      if (generation !== this.generation) return
      if (looksLikeAgentDatabaseDead(e)) {
        this.pauseAfterDeadDatabase(e, generation)
        return
      }
      logger.warn('[SummaryFileWatcher] fullScanArchives failed:', e as Error)
    } finally {
      this.tickInFlight = false
    }
  }
}

export const summaryFileWatcher = new SummaryFileWatcherService()
