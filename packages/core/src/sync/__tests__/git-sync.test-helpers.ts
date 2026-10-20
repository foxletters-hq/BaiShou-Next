import { vi } from 'vitest'
import type { IGitSyncService } from '../git-sync.interface'

export function createGitSyncServiceMock(): IGitSyncService {
  return {
    init: vi.fn(),
    isInitialized: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    testRemoteConnection: vi.fn(),
    commit: vi.fn(),
    commitAll: vi.fn(),
    commitStaged: vi.fn(),
    getHistory: vi.fn(),
    getCommitChanges: vi.fn(),
    getFileDiff: vi.fn(),
    rollbackFile: vi.fn(),
    rollbackAll: vi.fn(),
    push: vi.fn(),
    pull: vi.fn(),
    hasConflicts: vi.fn(),
    getConflicts: vi.fn(),
    resolveConflict: vi.fn()
  } as unknown as IGitSyncService
}

export function createMockPathService() {
  return {
    getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
  } as any
}
