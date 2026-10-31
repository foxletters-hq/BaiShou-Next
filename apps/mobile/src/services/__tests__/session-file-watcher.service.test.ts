import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockIsAgentStreamSessionBusy, mockWaitForExpoAgentDatabaseIdle } = vi.hoisted(() => ({
  mockIsAgentStreamSessionBusy: vi.fn<(sessionId?: string | null) => boolean>(() => false),
  mockWaitForExpoAgentDatabaseIdle: vi.fn<() => Promise<void>>(() => Promise.resolve())
}))

vi.mock('@baishou/ai', () => ({
  isAgentStreamSessionBusy: mockIsAgentStreamSessionBusy
}))

vi.mock('@baishou/database', () => ({
  isExpoSqliteNativeUnavailableError: () => false,
  isSqliteDatabaseLockedError: () => false,
  runWithSqliteBusyRetry: async <T>(fn: () => Promise<T>) => fn(),
  waitForExpoAgentDatabaseIdle: mockWaitForExpoAgentDatabaseIdle
}))

vi.mock('../mobile-diagnostic-log.service', () => ({
  appendDiagnosticBreadcrumb: vi.fn()
}))

import {
  SessionFileWatcherService,
  createMobileSessionDiskPersistenceHooks,
  sessionFileWatcher
} from '../session-file-watcher.service'

describe('SessionFileWatcherService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockIsAgentStreamSessionBusy.mockReset()
    mockIsAgentStreamSessionBusy.mockReturnValue(false)
    mockWaitForExpoAgentDatabaseIdle.mockReset()
    mockWaitForExpoAgentDatabaseIdle.mockResolvedValue(undefined)
  })

  afterEach(() => {
    sessionFileWatcher.stop()
    vi.useRealTimers()
  })

  it('does not record stale mtime while disk persistence is in-flight, then records settled mtime while suppressed during streaming', async () => {
    const watcher = new SessionFileWatcherService()
    let currentMtime = 1000
    let pendingPersistence = true
    let streamBusy = true
    const syncSessionFile = vi.fn().mockResolvedValue(undefined)

    const deps = {
      sessionFileService: {} as never,
      sessionSyncService: { syncSessionFile } as never,
      fileSystem: {
        readdir: vi.fn().mockResolvedValue(['sess-1.json']),
        stat: vi.fn().mockImplementation(async () => ({
          mtimeMs: currentMtime,
          size: 512
        }))
      } as never,
      sessionManager: {
        hasPendingDiskPersistence: vi.fn(() => pendingPersistence)
      }
    }

    mockIsAgentStreamSessionBusy.mockImplementation(() => streamBusy)

    watcher.start('/vault/Sessions', deps)
    watcher.suppressSession('sess-1', 20000)

    // 第 1 轮：onBeforeWrite 已触发抑制，但 writeSession 仍在执行中（mtime 仍是旧值 1000）
    await (watcher as unknown as { tick: () => Promise<void> }).tick()
    expect(syncSessionFile).not.toHaveBeenCalled()

    // 写盘完成：mtime 更新为 2000，pendingPersistence 变为 false，但流式仍在继续（streamBusy = true）
    currentMtime = 2000
    pendingPersistence = false
    watcher.suppressSession('sess-1', 20000)

    // 第 2 轮：写盘已落定且处于抑制窗口内，即使 streamBusy 为 true 也应记录新 mtime=2000
    await (watcher as unknown as { tick: () => Promise<void> }).tick()
    expect(syncSessionFile).not.toHaveBeenCalled()

    // 流式结束且抑制窗口过期后，文件 mtime 仍为 2000，不应把本端刚写完的文件误判为外部改动回灌 SQLite
    streamBusy = false
    vi.advanceTimersByTime(25000)
    await (watcher as unknown as { tick: () => Promise<void> }).tick()
    expect(syncSessionFile).not.toHaveBeenCalled()

    watcher.stop()
  })

  it('re-checks suppression and pending persistence after waitForExpoAgentDatabaseIdle before syncing', async () => {
    const watcher = new SessionFileWatcherService()
    const syncSessionFile = vi.fn().mockResolvedValue(undefined)
    let tickWaitCalls = 0

    const deps = {
      sessionFileService: {} as never,
      sessionSyncService: { syncSessionFile } as never,
      fileSystem: {
        readdir: vi.fn().mockResolvedValue(['sess-2.json']),
        stat: vi.fn().mockResolvedValue({
          mtimeMs: 3000,
          size: 256
        })
      } as never,
      sessionManager: {
        hasPendingDiskPersistence: vi.fn(() => false)
      }
    }

    // 模拟在 syncSessionFileQuiet 等待数据库空闲期间，本端触发了写盘抑制
    mockWaitForExpoAgentDatabaseIdle.mockImplementation(async () => {
      tickWaitCalls += 1
      if (tickWaitCalls === 2) {
        watcher.suppressSession('sess-2', 20000)
      }
    })

    watcher.start('/vault/Sessions', deps)
    await (watcher as unknown as { tick: () => Promise<void> }).tick()

    expect(syncSessionFile).not.toHaveBeenCalled()
    watcher.stop()
  })

  it('wires both onBeforeWrite and onAfterWrite to suppressSession', () => {
    const spy = vi.spyOn(sessionFileWatcher, 'suppressSession')
    const hooks = createMobileSessionDiskPersistenceHooks()

    hooks.onBeforeWrite?.('sess-hook', 'sess-hook')
    hooks.onAfterWrite?.('sess-hook', 'sess-hook')

    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenNthCalledWith(1, 'sess-hook')
    expect(spy).toHaveBeenNthCalledWith(2, 'sess-hook')
    spy.mockRestore()
  })
})
