import { AppState, type AppStateStatus } from 'react-native'
import type { SummarySyncService } from '@baishou/core-mobile'
import { logger } from '@baishou/shared'

/**
 * 定期触发总结文件全量扫描（对齐桌面 summary-watcher 的 debounced fullScan）。
 */
export class SummaryFileWatcherService {
  private timer: ReturnType<typeof setInterval> | null = null
  private appStateSub: { remove: () => void } | null = null
  private summarySync: SummarySyncService | null = null

  start(summarySync: SummarySyncService) {
    this.stop()
    this.summarySync = summarySync
    this.appStateSub = AppState.addEventListener('change', this.onAppState)
    this.timer = setInterval(() => void this.tick(), 15000)
    logger.info('[SummaryFileWatcher] started')
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.appStateSub?.remove()
    this.appStateSub = null
    this.summarySync = null
  }

  private onAppState = (state: AppStateStatus) => {
    if (state === 'active') void this.tick()
  }

  private async tick() {
    if (!this.summarySync || AppState.currentState !== 'active') return
    try {
      await this.summarySync.fullScanArchives()
    } catch (e) {
      logger.warn('[SummaryFileWatcher] fullScanArchives failed:', e)
    }
  }
}

export const summaryFileWatcher = new SummaryFileWatcherService()
