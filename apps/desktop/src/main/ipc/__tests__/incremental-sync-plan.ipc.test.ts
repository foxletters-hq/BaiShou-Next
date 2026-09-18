import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}))

vi.mock('../vault.ipc', () => ({
  pathService: {},
  vaultService: {},
  notifyVaultRegistryUpdated: vi.fn()
}))

vi.mock('../incremental-sync-service.factory', () => ({
  getSyncService: vi.fn(),
  getOrchestrator: vi.fn()
}))

import { incrementalSyncNeedsBootstrap } from '../incremental-sync-plan.ipc'

describe('incrementalSyncNeedsBootstrap', () => {
  it('should require index bootstrap when local files were downloaded or deleted', () => {
    expect(
      incrementalSyncNeedsBootstrap({
        downloaded: ['Journals/a.md'],
        deletedLocal: []
      })
    ).toBe(true)
    expect(
      incrementalSyncNeedsBootstrap({
        downloaded: [],
        deletedLocal: ['Sessions/s.json']
      })
    ).toBe(true)
  })

  it('should skip index bootstrap when only remote uploads or conflicts changed', () => {
    expect(
      incrementalSyncNeedsBootstrap({
        downloaded: [],
        deletedLocal: [],
        uploaded: ['Journals/a.md'],
        deletedRemote: ['old.md'],
        conflicted: ['x.md']
      })
    ).toBe(false)
  })
})
