import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] }
}))

import { WorkspaceFolderWatcherService } from '../workspace-folder-watcher.service'

type WatchListener = (eventName: string, fullPath: string) => void

function createFakeWatcher() {
  let listener: WatchListener | null = null
  return {
    on: vi.fn((eventName: string, next: WatchListener) => {
      if (eventName === 'all') listener = next
    }),
    close: vi.fn(),
    emit(eventName: string, fullPath: string) {
      listener?.(eventName, fullPath)
    }
  }
}

const presentDir = () => ({ exists: true, isDirectory: true })

describe('WorkspaceFolderWatcherService', () => {
  const root = path.resolve('baishou-watch-test-proj')
  const other = path.resolve('baishou-watch-test-other')

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should debounce then broadcast a relative path when a file is added', () => {
    const fake = createFakeWatcher()
    const broadcast = vi.fn()
    const service = new WorkspaceFolderWatcherService({
      watch: () => fake,
      stat: presentDir,
      broadcast,
      debounceMs: 500
    })

    service.acquire(root)
    fake.emit('add', path.join(root, 'src', 'a.ts'))
    expect(broadcast).not.toHaveBeenCalled()

    vi.advanceTimersByTime(499)
    expect(broadcast).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(broadcast).toHaveBeenCalledTimes(1)
    expect(broadcast).toHaveBeenCalledWith({
      folderRoot: root,
      path: 'src/a.ts',
      kind: 'create'
    })
  })

  it('should merge several events in one debounce window', () => {
    const fake = createFakeWatcher()
    const broadcast = vi.fn()
    const service = new WorkspaceFolderWatcherService({
      watch: () => fake,
      stat: presentDir,
      broadcast,
      debounceMs: 500
    })

    service.acquire(root)
    fake.emit('add', path.join(root, 'a.ts'))
    fake.emit('change', path.join(root, 'b.ts'))
    vi.advanceTimersByTime(500)

    expect(broadcast).toHaveBeenCalledTimes(2)
    expect(broadcast).toHaveBeenCalledWith({
      folderRoot: root,
      path: 'a.ts',
      kind: 'create'
    })
    expect(broadcast).toHaveBeenCalledWith({
      folderRoot: root,
      path: 'b.ts',
      kind: 'modify'
    })
  })

  it('should ignore .git and node_modules paths', () => {
    const fake = createFakeWatcher()
    const broadcast = vi.fn()
    const service = new WorkspaceFolderWatcherService({
      watch: () => fake,
      stat: presentDir,
      broadcast,
      debounceMs: 500
    })

    service.acquire(root)
    fake.emit('add', path.join(root, '.git', 'HEAD'))
    fake.emit('add', path.join(root, 'node_modules', 'pkg', 'index.js'))
    vi.advanceTimersByTime(500)
    expect(broadcast).not.toHaveBeenCalled()
  })

  it('should keep one watcher when the same folder is acquired twice', () => {
    const watch = vi.fn(() => createFakeWatcher())
    const service = new WorkspaceFolderWatcherService({
      watch,
      stat: presentDir,
      broadcast: vi.fn(),
      debounceMs: 500
    })

    service.acquire(root)
    service.acquire(root)
    expect(watch).toHaveBeenCalledTimes(1)

    service.release(root)
    expect(watch.mock.results[0]?.value.close).not.toHaveBeenCalled()

    service.release(root)
    expect(watch.mock.results[0]?.value.close).toHaveBeenCalledTimes(1)
  })

  it('should return false and not start a watcher when the folder does not exist', () => {
    const watch = vi.fn(() => createFakeWatcher())
    const service = new WorkspaceFolderWatcherService({
      watch,
      stat: () => ({ exists: false, isDirectory: false }),
      broadcast: vi.fn(),
      debounceMs: 500
    })

    expect(service.acquire(root)).toBe(false)
    expect(watch).not.toHaveBeenCalled()
  })

  it('should return false when the path is a file or a filesystem root', () => {
    const watch = vi.fn(() => createFakeWatcher())
    const fileService = new WorkspaceFolderWatcherService({
      watch,
      stat: () => ({ exists: true, isDirectory: false }),
      broadcast: vi.fn(),
      debounceMs: 500
    })
    expect(fileService.acquire(root)).toBe(false)

    const rootService = new WorkspaceFolderWatcherService({
      watch,
      stat: () => ({ exists: true, isDirectory: true }),
      broadcast: vi.fn(),
      debounceMs: 500
    })
    expect(rootService.acquire(path.parse(process.cwd()).root)).toBe(false)
    expect(watch).not.toHaveBeenCalled()
  })

  it('should still broadcast files when the workspace itself sits under node_modules', () => {
    const nestedRoot = path.join(process.cwd(), 'node_modules', 'pkg-src')
    const fake = createFakeWatcher()
    const broadcast = vi.fn()
    const service = new WorkspaceFolderWatcherService({
      watch: () => fake,
      stat: presentDir,
      broadcast,
      debounceMs: 500
    })

    expect(service.acquire(nestedRoot)).toBe(true)
    fake.emit('add', path.join(nestedRoot, 'src', 'a.ts'))
    vi.advanceTimersByTime(500)
    expect(broadcast).toHaveBeenCalledWith({
      folderRoot: path.resolve(nestedRoot),
      path: 'src/a.ts',
      kind: 'create'
    })
  })

  it('should watch two folders independently', () => {
    const first = createFakeWatcher()
    const second = createFakeWatcher()
    const watchers = [first, second]
    const broadcast = vi.fn()
    const service = new WorkspaceFolderWatcherService({
      watch: () => watchers.shift() ?? createFakeWatcher(),
      stat: presentDir,
      broadcast,
      debounceMs: 500
    })

    service.acquire(root)
    service.acquire(other)
    first.emit('add', path.join(root, 'a.ts'))
    second.emit('add', path.join(other, 'b.ts'))
    vi.advanceTimersByTime(500)

    expect(broadcast).toHaveBeenCalledWith({
      folderRoot: root,
      path: 'a.ts',
      kind: 'create'
    })
    expect(broadcast).toHaveBeenCalledWith({
      folderRoot: other,
      path: 'b.ts',
      kind: 'create'
    })
  })
})
