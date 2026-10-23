import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  BAISHOU_WORKSPACE_AGENT_GATE_CONFIG_KEY,
  WORKSPACE_PERSONAL_MEMORY_READ_POLICY_KEY,
  WORKSPACE_TOOL_MANAGEMENT_POLICY_KEY
} from '@baishou/shared'

const invalidateMcpToolContextCache = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] }
}))

vi.mock('../../ipc/agent-helpers', () => ({
  invalidateMcpToolContextCache
}))

vi.mock('../../ipc/summary.ipc', () => ({
  resetCachedManager: vi.fn()
}))

vi.mock('../../ipc/attachment-path-cache', () => ({
  resetAttachmentAllowedRootsCache: vi.fn()
}))

describe('initDesktopMainCacheCoordinator', () => {
  beforeEach(() => {
    invalidateMcpToolContextCache.mockClear()
  })

  it('clears mcp.toolContext when settings.update arrives on the main-process bus', async () => {
    const { initDesktopMainCacheCoordinator } = await import('../desktop-main-cache-coordinator')
    const { emitDomainMutation } = await import('@baishou/core-desktop')
    const unsub = initDesktopMainCacheCoordinator()

    const keys = [
      BAISHOU_AGENT_GATE_CONFIG_KEY,
      BAISHOU_WORKSPACE_AGENT_GATE_CONFIG_KEY,
      WORKSPACE_TOOL_MANAGEMENT_POLICY_KEY,
      WORKSPACE_PERSONAL_MEMORY_READ_POLICY_KEY
    ]
    for (const key of keys) {
      invalidateMcpToolContextCache.mockClear()
      emitDomainMutation({ domain: 'settings', action: 'update', meta: { key } })
      expect(invalidateMcpToolContextCache).toHaveBeenCalled()
    }

    unsub()
  })
})
