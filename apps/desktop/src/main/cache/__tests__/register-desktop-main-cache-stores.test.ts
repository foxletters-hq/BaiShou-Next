import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { applyCacheInvalidation, globalCacheRegistry } from '@baishou/shared/cache'

const resetCachedManager = vi.fn()

vi.mock('../../ipc/summary.ipc', () => ({
  resetCachedManager
}))

vi.mock('../../ipc/agent-helpers', () => ({
  invalidateMcpToolContextCache: vi.fn()
}))

vi.mock('../../ipc/attachment-path-cache', () => ({
  resetAttachmentAllowedRootsCache: vi.fn()
}))

describe('registerDesktopMainCacheStores', () => {
  beforeAll(async () => {
    const { registerDesktopMainCacheStores } = await import('../register-desktop-main-cache-stores')
    registerDesktopMainCacheStores()
  })

  beforeEach(() => {
    resetCachedManager.mockClear()
  })

  it('does not reset SummaryManager on diary-driven dashboard invalidation', () => {
    applyCacheInvalidation(
      { domain: 'diary', action: 'update', timestamp: Date.now() },
      globalCacheRegistry
    )
    expect(resetCachedManager).not.toHaveBeenCalled()
  })

  it('does not reset SummaryManager on summary.gallery invalidate', () => {
    globalCacheRegistry.invalidate(['summary.gallery'], 'test')
    expect(resetCachedManager).not.toHaveBeenCalled()
  })

  it('resets SummaryManager on vault.switch clearAll', () => {
    applyCacheInvalidation(
      { domain: 'vault', action: 'switch', vaultKey: 'Work', timestamp: Date.now() },
      globalCacheRegistry
    )
    expect(resetCachedManager).toHaveBeenCalledTimes(1)
  })
})
