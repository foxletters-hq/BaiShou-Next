import { AppState, type AppStateStatus } from 'react-native'
import type {
  SessionFileService,
  SessionSyncService,
  SessionManagerService
} from '@baishou/core-mobile'
import type { IFileSystem } from '@baishou/core-mobile'
import { joinPath } from '@baishou/core-mobile'
import { logger } from '@baishou/shared'

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
        try {
          const st = await this.deps.fileSystem.stat(fp)
          mtime = (st as { mtimeMs?: number }).mtimeMs ?? Date.now()
        } catch {
          continue
        }
        const prev = this.mtimes.get(fp)
        if (prev !== undefined && prev === mtime) continue
        this.mtimes.set(fp, mtime)
        const sessionId = name.replace(/\.json$/, '')
        try {
          await this.deps.sessionSyncService.syncSessionFile(sessionId)
        } catch (e) {
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
