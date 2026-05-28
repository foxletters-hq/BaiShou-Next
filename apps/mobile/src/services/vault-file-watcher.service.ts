import { AppState, type AppStateStatus } from 'react-native'
import type { IFileSystem, ShadowIndexSyncService } from '@baishou/core-mobile'
import { logger } from '@baishou/shared'

const SCAN_INTERVAL_MS = 8000
const DEBOUNCE_MS = 500
const FULL_SCAN_EVERY_N_TICKS = 10

export interface VaultFileWatcherDeps {
  shadowIndexSyncService: ShadowIndexSyncService
  fileSystem: IFileSystem
}

/**
 * Polls Journals/*.md while app is active (no chokidar on mobile).
 */
export class VaultFileWatcherService {
  private vaultPath: string | null = null
  private deps: VaultFileWatcherDeps | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private appStateSub: { remove: () => void } | null = null
  private lastMtimes = new Map<string, number>()
  private pendingDates = new Set<string>()
  private tickCount = 0
  private isProcessing = false

  start(vaultPath: string, deps: VaultFileWatcherDeps): void {
    this.stop()
    this.vaultPath = vaultPath
    this.deps = deps
    this.lastMtimes.clear()
    this.tickCount = 0

    logger.info(`[VaultFileWatcher] Starting for ${vaultPath}`)

    this.appStateSub = AppState.addEventListener('change', this.onAppStateChange)
    if (AppState.currentState === 'active') {
      this.startPolling()
    }
  }

  stop(): void {
    if (this.appStateSub) {
      this.appStateSub.remove()
      this.appStateSub = null
    }
    this.stopPolling()
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.pendingDates.clear()
    this.lastMtimes.clear()
    this.vaultPath = null
    this.deps = null
    logger.info('[VaultFileWatcher] Stopped')
  }

  private onAppStateChange = (next: AppStateStatus) => {
    if (next === 'active') {
      this.startPolling()
      void this.scanOnce()
    } else {
      this.stopPolling()
    }
  }

  private startPolling(): void {
    if (this.intervalId) return
    this.intervalId = setInterval(() => {
      void this.scanOnce()
    }, SCAN_INTERVAL_MS)
  }

  private stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async scanOnce(): Promise<void> {
    if (!this.vaultPath || !this.deps) return

    this.tickCount += 1
    if (this.tickCount % FULL_SCAN_EVERY_N_TICKS === 0) {
      try {
        await this.deps.shadowIndexSyncService.fullScanVault(true)
      } catch (e) {
        logger.warn('[VaultFileWatcher] periodic fullScanVault failed:', e as Error)
      }
      return
    }

    const journalsPath = `${this.vaultPath}/Journals`
    const { fileSystem } = this.deps

    try {
      const exists = await fileSystem.exists(journalsPath)
      if (!exists) {
        await fileSystem.mkdir(journalsPath, { recursive: true })
        return
      }

      const files = await fileSystem.readdir(journalsPath)
      const dateRegex = /^(\d{4}-\d{2}-\d{2})\.md$/

      for (const fileName of files) {
        const match = dateRegex.exec(fileName)
        if (!match?.[1]) continue

        const fullPath = `${journalsPath}/${fileName}`
        try {
          const stat = await fileSystem.stat(fullPath)
          if (!stat.isFile) continue
          const mtime = (stat as { mtimeMs?: number }).mtimeMs ?? 0
          const prev = this.lastMtimes.get(fullPath)
          if (prev === undefined) {
            this.lastMtimes.set(fullPath, mtime)
            continue
          }
          if (mtime !== prev) {
            this.lastMtimes.set(fullPath, mtime)
            this.pendingDates.add(match[1])
          }
        } catch {
          // file may have been removed
          this.lastMtimes.delete(fullPath)
          this.pendingDates.add(match[1])
        }
      }

      if (this.pendingDates.size > 0) {
        this.scheduleProcess()
      }
    } catch (e) {
      logger.warn('[VaultFileWatcher] scan failed:', e as Error)
    }
  }

  private scheduleProcess(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      void this.processPending()
    }, DEBOUNCE_MS)
  }

  private async processPending(): Promise<void> {
    if (!this.deps || this.isProcessing || this.pendingDates.size === 0) return
    this.isProcessing = true
    const dates = Array.from(this.pendingDates)
    this.pendingDates.clear()

    try {
      await this.deps.shadowIndexSyncService.syncJournalsBatch(dates)
      logger.info(`[VaultFileWatcher] synced ${dates.length} journal(s)`)
    } catch (e) {
      logger.error('[VaultFileWatcher] syncJournalsBatch failed:', e as Error)
      dates.forEach((d) => this.pendingDates.add(d))
    } finally {
      this.isProcessing = false
      if (this.pendingDates.size > 0) {
        this.scheduleProcess()
      }
    }
  }
}

export const vaultFileWatcher = new VaultFileWatcherService()
