import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH } from '@baishou/shared'

vi.mock('../vault.ipc', () => ({
  pathService: {
    getRootDirectory: vi.fn(),
    getActiveVaultPath: vi.fn()
  }
}))

vi.mock('../git-sync.ipc', () => ({
  getGitService: vi.fn()
}))

import { getDefaultSyncConfig, resetSyncService } from '../incremental-sync-service.factory'

describe('getDefaultSyncConfig', () => {
  it('should disable sync and use the default cloud path when building the initial config', () => {
    expect(getDefaultSyncConfig()).toEqual({
      enabled: false,
      endpoint: '',
      region: '',
      bucket: '',
      path: DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
      accessKey: '',
      secretKey: '',
      fileConcurrency: 5,
      chunkConcurrency: 5,
      maxDivergencePercent: 100
    })
  })
})

describe('resetSyncService', () => {
  beforeEach(() => {
    resetSyncService()
  })

  it('should clear the cached service when reset is called after init', () => {
    expect(() => resetSyncService()).not.toThrow()
  })
})
