import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as chokidar from 'chokidar'
import { logger } from '@baishou/shared'
import {
  evaluateWorkspaceWatchTarget,
  mapWatchEventToKind,
  shouldIgnoreWorkspaceWatchPath,
  toWorkspaceRelativePath,
  workspaceFolderWatchKey,
  type WorkspaceFsChangedPayload
} from './workspace-folder-watcher.util'

type WatcherLike = {
  on: (eventName: 'all', listener: (eventName: string, fullPath: string) => void) => unknown
  close: () => unknown
}

export type WorkspaceFolderStat = {
  exists: boolean
  isDirectory: boolean
}

export type WorkspaceFolderWatcherDeps = {
  watch: (folderRoot: string) => WatcherLike
  stat: (folderRoot: string) => WorkspaceFolderStat
  broadcast: (payload: WorkspaceFsChangedPayload) => void
  debounceMs?: number
}

const DEFAULT_DEBOUNCE_MS = 500

export function broadcastWorkspaceFsChanged(payload: WorkspaceFsChangedPayload): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    try {
      win.webContents.send('agent-workspace:fs-changed', payload)
    } catch {
      /* 窗口已关时不再通知树 */
    }
  }
}

function statFolder(folderRoot: string): WorkspaceFolderStat {
  try {
    const info = fs.statSync(folderRoot)
    return { exists: true, isDirectory: info.isDirectory() }
  } catch {
    return { exists: false, isDirectory: false }
  }
}

type WatchedFolder = {
  folderRoot: string
  refs: number
  watcher: WatcherLike
}

/**
 * 工作台当前打开目录的磁盘监听。
 * 写法和日记 watcher 相同：chokidar + 防抖 + 广播窗口；不碰 Vault 缓存。
 */
export class WorkspaceFolderWatcherService {
  private readonly deps: WorkspaceFolderWatcherDeps
  private readonly watched = new Map<string, WatchedFolder>()
  private readonly pending = new Map<string, WorkspaceFsChangedPayload>()
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  constructor(deps?: Partial<WorkspaceFolderWatcherDeps>) {
    this.deps = {
      watch:
        deps?.watch ??
        ((folderRoot) =>
          // 当前监视库已去掉 glob 解析，不再有 disableGlobbing；传入的是 resolve 后的绝对目录
          chokidar.watch(folderRoot, {
            ignored: (fullPath: string) => shouldIgnoreWorkspaceWatchPath(folderRoot, fullPath),
            ignoreInitial: true
          })),
      stat: deps?.stat ?? statFolder,
      broadcast: deps?.broadcast ?? broadcastWorkspaceFsChanged,
      debounceMs: deps?.debounceMs ?? DEFAULT_DEBOUNCE_MS
    }
  }

  acquire(folderRoot: string): boolean {
    const resolved = path.resolve(folderRoot)
    const key = workspaceFolderWatchKey(resolved)
    const existing = this.watched.get(key)
    if (existing) {
      existing.refs += 1
      return true
    }

    const status = evaluateWorkspaceWatchTarget(resolved, this.deps.stat(resolved))
    if (status !== 'ok') {
      logger.warn(`[WorkspaceFolderWatcher] 跳过监听 (${status}): ${resolved}`)
      return false
    }

    const watcher = this.deps.watch(resolved)
    watcher.on('all', (eventName, fullPath) => {
      this.schedule(resolved, eventName, fullPath)
    })
    this.watched.set(key, { folderRoot: resolved, refs: 1, watcher })
    logger.info(`[WorkspaceFolderWatcher] 监听已启动: ${resolved}`)
    return true
  }

  release(folderRoot: string): void {
    const key = workspaceFolderWatchKey(folderRoot)
    const existing = this.watched.get(key)
    if (!existing) return
    existing.refs -= 1
    if (existing.refs > 0) return
    void existing.watcher.close()
    this.watched.delete(key)
    logger.info(`[WorkspaceFolderWatcher] 监听已停止: ${existing.folderRoot}`)
  }

  stop(): void {
    for (const entry of this.watched.values()) {
      void entry.watcher.close()
    }
    this.watched.clear()
    this.pending.clear()
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  private schedule(folderRoot: string, eventName: string, fullPath: string): void {
    if (shouldIgnoreWorkspaceWatchPath(folderRoot, fullPath)) return
    const kind = mapWatchEventToKind(eventName)
    if (!kind) return
    const relativePath = toWorkspaceRelativePath(folderRoot, fullPath)
    if (relativePath == null || relativePath === '') return

    const pendingKey = `${workspaceFolderWatchKey(folderRoot)}\0${relativePath}`
    this.pending.set(pendingKey, { folderRoot, path: relativePath, kind })
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.flush()
    }, this.deps.debounceMs ?? DEFAULT_DEBOUNCE_MS)
  }

  private flush(): void {
    this.debounceTimer = null
    const payloads = [...this.pending.values()]
    this.pending.clear()
    for (const payload of payloads) {
      this.deps.broadcast(payload)
    }
  }
}

export const workspaceFolderWatcher = new WorkspaceFolderWatcherService()
