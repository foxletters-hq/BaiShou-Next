import { AppState, type AppStateStatus } from 'react-native'
import type {
  SessionFileService,
  SessionSyncService,
  SessionDiskPersistenceHooks
} from '@baishou/core-mobile'
import type { IFileSystem } from '@baishou/core-mobile'
import { joinPath } from '@baishou/core-mobile'
import {
  isSqliteDatabaseLockedError,
  runWithSqliteBusyRetry,
  waitForExpoAgentDatabaseIdle
} from '@baishou/database'
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
  fileSystem: IFileSystem
}

const DEFAULT_SUPPRESS_MS = 8000
const MAX_SYNCS_PER_TICK = 2
const INTER_SYNC_IDLE_MS = 40

export function createMobileSessionDiskPersistenceHooks(): SessionDiskPersistenceHooks {
  return {
    onBeforeWrite: (sessionId) => {
      sessionFileWatcher.suppressSession(sessionId)
    }
  }
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
  private suppressedSessions = new Map<string, number>()
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
    this.suppressedSessions.clear()
    this.deps = null
  }

  /** 本端落盘 JSON 时抑制回环同步（对齐桌面 sessionWatcher.suppressPath） */
  suppressSession(sessionId: string, durationMs = DEFAULT_SUPPRESS_MS): void {
    if (!sessionId) return
    this.suppressedSessions.set(sessionId, Date.now() + durationMs)
  }

  private isSuppressed(sessionId: string): boolean {
    const expiry = this.suppressedSessions.get(sessionId)
    if (!expiry) return false
    if (Date.now() > expiry) {
      this.suppressedSessions.delete(sessionId)
      return false
    }
    return true
  }

  async waitUntilIdle(): Promise<void> {
    while (this.tickInFlight) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  private onAppState = (state: AppStateStatus) => {
    if (state === 'active') void this.tick()
  }

  private async syncSessionFileQuiet(sessionId: string): Promise<void> {
    await waitForExpoAgentDatabaseIdle()
    await runWithSqliteBusyRetry(() => this.deps!.sessionSyncService.syncSessionFile(sessionId))
  }

  private async tick() {
    if (!this.deps || !this.sessionsDir || this.tickInFlight) return
    if (AppState.currentState !== 'active') return
    this.tickInFlight = true
    try {
      await waitForExpoAgentDatabaseIdle()
      const files = await this.deps.fileSystem.readdir(this.sessionsDir)
      const pending: Array<{ name: string; fp: string; mtime: number; sessionId: string }> = []

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

        const sessionId = name.replace(/\.json$/, '')
        if (this.isSuppressed(sessionId)) {
          this.mtimes.set(fp, mtime)
          continue
        }

        pending.push({ name, fp, mtime, sessionId })
      }

      let synced = 0
      for (const item of pending) {
        if (synced >= MAX_SYNCS_PER_TICK) break
        try {
          await this.syncSessionFileQuiet(item.sessionId)
          this.mtimes.set(item.fp, item.mtime)
          synced += 1
          if (synced < MAX_SYNCS_PER_TICK && synced < pending.length) {
            await new Promise((resolve) => setTimeout(resolve, INTER_SYNC_IDLE_MS))
          }
        } catch (e) {
          if (isOversizedReadFailure(e)) {
            if (!this.skippedOversized.has(item.fp)) {
              this.skippedOversized.add(item.fp)
              const msg = `[SessionFileWatcher] skip oversized session ${item.name} after read failure (${String((e as Error)?.message ?? e).slice(0, 160)})`
              logger.warn(msg)
              appendDiagnosticBreadcrumb(msg)
            }
            this.mtimes.set(item.fp, item.mtime)
            continue
          }
          if (isSqliteDatabaseLockedError(e)) {
            logger.info(
              `[SessionFileWatcher] defer sync for ${item.name} (database busy, will retry)`
            )
            continue
          }
          logger.warn(`[SessionFileWatcher] sync failed for ${item.name}:`, e as Error)
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
