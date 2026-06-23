import { AppState, type AppStateStatus } from 'react-native'
import { collectJournalPathsByDateInTree } from '@baishou/core'
import type { IFileSystem, ShadowIndexSyncService } from '@baishou/core-mobile'
import { logger } from '@baishou/shared'

const SCAN_INTERVAL_MS = 8000
const DEBOUNCE_MS = 500

export interface VaultFileWatcherDeps {
  shadowIndexSyncService: ShadowIndexSyncService
  fileSystem: IFileSystem
}

/**
 * Polls nested journal markdown files under Journals while app is active (no chokidar on mobile).
 * 使用嵌套目录遍历替代周期性 fullScanVault，避免扫描中途索引抖动导致列表错乱。
 */
export class VaultFileWatcherService {
  private journalsPath: string | null = null
  private deps: VaultFileWatcherDeps | null = null
  private createIfMissing = true
  private intervalId: ReturnType<typeof setInterval> | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private appStateSub: { remove: () => void } | null = null
  private lastMtimes = new Map<string, number>()
  private pendingDates = new Set<string>()
  private isProcessing = false

  start(
    journalsBasePath: string,
    deps: VaultFileWatcherDeps,
    options?: { createIfMissing?: boolean }
  ): void {
    this.stop()
    this.journalsPath = journalsBasePath
    this.deps = deps
    this.createIfMissing = options?.createIfMissing ?? true
    this.lastMtimes.clear()

    logger.info(`[VaultFileWatcher] Starting for ${journalsBasePath}`)

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
    this.journalsPath = null
    this.deps = null
    this.createIfMissing = true
    logger.info('[VaultFileWatcher] Stopped')
  }

  /** 等待进行中的增量同步结束（切换 Vault 前调用） */
  async waitUntilIdle(): Promise<void> {
    while (this.isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
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
    if (!this.journalsPath || !this.deps) return

    const journalsPath = this.journalsPath
    const { fileSystem } = this.deps

    try {
      const exists = await fileSystem.exists(journalsPath)
      if (!exists) {
        if (this.createIfMissing) {
          await fileSystem.mkdir(journalsPath, { recursive: true })
        } else {
          logger.warn(
            `[VaultFileWatcher] External journals directory missing, skipping scan: ${journalsPath}`
          )
        }
        return
      }

      const { pathsByDate } = await collectJournalPathsByDateInTree(fileSystem, journalsPath)

      for (const [dateStr, fullPath] of pathsByDate) {
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
            this.pendingDates.add(dateStr)
          }
        } catch {
          this.lastMtimes.delete(fullPath)
          this.pendingDates.add(dateStr)
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
