import { AppState, type AppStateStatus } from 'react-native'
import type {
  SessionFileService,
  SessionSyncService,
  SessionDiskPersistenceHooks
} from '@baishou/core-mobile'
import type { IFileSystem } from '@baishou/core-mobile'
import { joinPath } from '@baishou/core-mobile'
import {
  isExpoSqliteNativeUnavailableError,
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

/** 本地兜底：不依赖 package 解析，避免 Metro 旧包漏掉识别 */
function looksLikeAgentDatabaseDead(error: unknown): boolean {
  if (isSqliteDatabaseLockedError(error)) return false
  if (isExpoSqliteNativeUnavailableError(error)) return true
  const text = `${String((error as Error)?.message ?? '')}\n${String(error)}`.toLowerCase()
  return (
    text.includes('nullpointerexception') ||
    text.includes('nativedatabase.execasync') ||
    text.includes('nativedatabase.preparesync') ||
    text.includes("nativedatabase.execasync' has been rejected") ||
    text.includes("nativedatabase.preparesync' has been rejected")
  )
}

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
  /** 每次 start/stop 递增，用于丢弃陈旧异步 tick / 延迟 start */
  private generation = 0
  private pausedForDeadDb = false
  private unavailableLoggedForGeneration = -1

  start(sessionsBaseDir: string, deps: WatcherDeps) {
    this.stopTimerOnly()
    this.generation += 1
    this.pausedForDeadDb = false
    this.unavailableLoggedForGeneration = -1
    this.sessionsDir = sessionsBaseDir
    this.deps = deps
    this.appStateSub?.remove()
    this.appStateSub = AppState.addEventListener('change', this.onAppState)
    this.timer = setInterval(() => void this.tick(), 8000)
    logger.info('[SessionFileWatcher] started')
  }

  stop() {
    this.generation += 1
    this.pausedForDeadDb = false
    this.stopTimerOnly()
    this.appStateSub?.remove()
    this.appStateSub = null
    this.sessionsDir = null
    this.mtimes.clear()
    this.skippedOversized.clear()
    this.suppressedSessions.clear()
    this.deps = null
  }

  private stopTimerOnly() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** DB 句柄失效时停掉轮询，避免每 8s 对全部 json 重试刷屏 */
  private pauseAfterDeadDatabase(error: unknown, generation: number) {
    if (this.unavailableLoggedForGeneration !== generation) {
      this.unavailableLoggedForGeneration = generation
      logger.warn(
        '[SessionFileWatcher] agent database unavailable; paused until watcher restarts',
        error as Error
      )
      appendDiagnosticBreadcrumb(
        '[SessionFileWatcher] paused: agent database unavailable (NativeDatabase NPE)'
      )
    }
    this.pausedForDeadDb = true
    this.stopTimerOnly()
  }

  /** 供延迟启动：若期间已 stop/再次 start，则取消本次 start */
  getGeneration(): number {
    return this.generation
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
    if (state !== 'active') return
    // 若因死库暂停，回到前台也不自动狂刷；等 restartVaultWatchers / start()
    if (this.pausedForDeadDb || !this.deps || !this.sessionsDir) return
    void this.tick()
  }

  private async syncSessionFileQuiet(
    sessionId: string,
    deps: WatcherDeps,
    generation: number
  ): Promise<void> {
    await waitForExpoAgentDatabaseIdle()
    if (generation !== this.generation || this.deps !== deps) return
    await runWithSqliteBusyRetry(() => deps.sessionSyncService.syncSessionFile(sessionId))
  }

  private async tick() {
    const generation = this.generation
    const deps = this.deps
    const sessionsDir = this.sessionsDir
    if (!deps || !sessionsDir || this.tickInFlight || this.pausedForDeadDb) return
    if (AppState.currentState !== 'active') return
    this.tickInFlight = true
    try {
      await waitForExpoAgentDatabaseIdle()
      if (generation !== this.generation || this.deps !== deps || this.pausedForDeadDb) return

      const files = await deps.fileSystem.readdir(sessionsDir)
      if (generation !== this.generation || this.deps !== deps || this.pausedForDeadDb) return

      const pending: Array<{ name: string; fp: string; mtime: number; sessionId: string }> = []

      for (const name of files) {
        if (!name.endsWith('.json')) continue
        const fp = joinPath(sessionsDir, name)
        let mtime = 0
        let size: number | undefined
        try {
          const st = await deps.fileSystem.stat(fp)
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
        if (generation !== this.generation || this.deps !== deps || this.pausedForDeadDb) return
        if (synced >= MAX_SYNCS_PER_TICK) break
        try {
          await this.syncSessionFileQuiet(item.sessionId, deps, generation)
          if (generation !== this.generation || this.deps !== deps || this.pausedForDeadDb) return
          this.mtimes.set(item.fp, item.mtime)
          synced += 1
          if (synced < MAX_SYNCS_PER_TICK && synced < pending.length) {
            await new Promise((resolve) => setTimeout(resolve, INTER_SYNC_IDLE_MS))
          }
        } catch (e) {
          if (generation !== this.generation || this.deps !== deps) return
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
          if (looksLikeAgentDatabaseDead(e)) {
            this.pauseAfterDeadDatabase(e, generation)
            return
          }
          // 其它错误：记 mtime 避免同一坏文件每轮刷屏；真正内容变更会改 mtime
          this.mtimes.set(item.fp, item.mtime)
          logger.warn(`[SessionFileWatcher] sync failed for ${item.name}:`, e as Error)
        }
      }
    } catch (e) {
      if (generation === this.generation) {
        if (looksLikeAgentDatabaseDead(e)) {
          this.pauseAfterDeadDatabase(e, generation)
        } else {
          logger.warn('[SessionFileWatcher] tick error:', e as Error)
        }
      }
    } finally {
      this.tickInFlight = false
    }
  }
}

export const sessionFileWatcher = new SessionFileWatcherService()
