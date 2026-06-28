import { AppState, type AppStateStatus } from 'react-native'
import type {
  SessionFileService,
  SessionSyncService,
  SessionManagerService
} from '@baishou/core-mobile'
import type { IFileSystem } from '@baishou/core-mobile'
import { joinPath } from '@baishou/core-mobile'
import { logger } from '@baishou/shared'
import { appendDiagnosticBreadcrumb } from './mobile-diagnostic-log.service'
import {
  MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES,
  exceedsMobileExternalTextReadLimit,
  isOversizedReadFailure
} from './mobile-file-read-limits'

type WatcherDeps = {
  sessionFileService: SessionFileService
  sessionSyncService: SessionSyncService
  sessionManager: SessionManagerService
  fileSystem: IFileSystem
}

/**
 * 轮询 Sessions 目录 JSON，将外部写入同步进 SQLite（对齐桌面 session-watcher）。
 */
export class SessionFileWatcherService {
  private timer: ReturnType<typeof setInterval> | null = null
  private appStateSub: { remove: () => void } | null = null
  private sessionsDir: string | null = null
  private mtimes = new Map<string, number>()
  private skippedOversized = new Set<string>()
  private deps: WatcherDeps | null = null
  private tickInFlight = false

  start(sessionsBaseDir: string, deps: WatcherDeps) {
    this.stop()
    this.sessionsDir = sessionsBaseDir
    this.deps = deps
    this.appStateSub = AppState.addEventListener('change', this.onAppState)
    this.timer = setInterval(() => void this.tick(), 8000)
    logger.info('[SessionFileWatcher] started')
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.appStateSub?.remove()
    this.appStateSub = null
    this.sessionsDir = null
    this.mtimes.clear()
    this.skippedOversized.clear()
    this.deps = null
  }

  async waitUntilIdle(): Promise<void> {
    while (this.tickInFlight) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  private onAppState = (state: AppStateStatus) => {
    if (state === 'active') void this.tick()
  }

  private async tick() {
    if (!this.deps || !this.sessionsDir || this.tickInFlight) return
    if (AppState.currentState !== 'active') return
    this.tickInFlight = true
    try {
      const files = await this.deps.fileSystem.readdir(this.sessionsDir)
      for (const name of files) {
        if (!name.endsWith('.json')) continue
        const fp = joinPath(this.sessionsDir, name)
        let mtime = 0
        let size: number | undefined
        try {
          const st = await this.deps.fileSystem.stat(fp)
          mtime = st.mtimeMs ?? Date.now()
          size = st.size
        } catch {
          continue
        }

        if (exceedsMobileExternalTextReadLimit(size)) {
          if (!this.skippedOversized.has(fp)) {
            this.skippedOversized.add(fp)
            const msg = `[SessionFileWatcher] skip oversized session ${name} (${size} bytes, limit ${MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES})`
            logger.warn(msg)
            appendDiagnosticBreadcrumb(msg)
          }
          this.mtimes.set(fp, mtime)
          continue
        }

        const prev = this.mtimes.get(fp)
        if (prev !== undefined && prev === mtime) continue
        this.mtimes.set(fp, mtime)
        const sessionId = name.replace(/\.json$/, '')
        try {
          await this.deps.sessionSyncService.syncSessionFile(sessionId)
        } catch (e) {
          if (isOversizedReadFailure(e)) {
            if (!this.skippedOversized.has(fp)) {
              this.skippedOversized.add(fp)
              const msg = `[SessionFileWatcher] skip oversized session ${name} after read failure (${String((e as Error)?.message ?? e).slice(0, 160)})`
              logger.warn(msg)
              appendDiagnosticBreadcrumb(msg)
            }
            continue
          }
          logger.warn(`[SessionFileWatcher] sync failed for ${name}:`, e as Error)
        }
      }
    } catch (e) {
      logger.warn('[SessionFileWatcher] tick error:', e as Error)
    } finally {
      this.tickInFlight = false
    }
  }
}

export const sessionFileWatcher = new SessionFileWatcherService()
