import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  WORKSPACE_PERSONAL_MEMORY_READ_POLICY_KEY,
  WORKSPACE_TOOL_MANAGEMENT_POLICY_KEY
} from '@baishou/shared'
import type { DomainMutationEvent } from '@baishou/shared/cache'

const appMock = vi.hoisted(() => ({
  getPath: vi.fn(() => '/mock/userData')
}))

const fspMock = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn()
}))

vi.mock('electron', () => ({ app: appMock }))
vi.mock('fs/promises', () => fspMock)
vi.mock('../workspace-agent-gate.store', () => ({
  getGlobalWorkspaceGateConfig: vi.fn(),
  setGlobalWorkspaceGateConfig: vi.fn()
}))

describe('agent-workspace-policy.store mutation emit', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    appMock.getPath.mockReturnValue('/mock/userData')
    fspMock.readFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
    fspMock.mkdir.mockResolvedValue(undefined)
    fspMock.writeFile.mockResolvedValue(undefined)
  })

  it('emits settings.update with workspace tool management key after write', async () => {
    const { domainMutationBus } = await import('@baishou/core-desktop')
    const { resetWorkspacePolicyCache, setWorkspaceToolManagement } =
      await import('../agent-workspace-policy.store')
    resetWorkspacePolicyCache()

    const events: DomainMutationEvent[] = []
    const unsub = domainMutationBus.subscribe((event) => {
      events.push(event)
    })
    await setWorkspaceToolManagement('ws-1', { disabledToolIds: [], customConfigs: {} })
    unsub()

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: 'settings',
          action: 'update',
          meta: { key: WORKSPACE_TOOL_MANAGEMENT_POLICY_KEY }
        })
      ])
    )
  })

  it('emits settings.update with personal memory read key after write', async () => {
    const { domainMutationBus } = await import('@baishou/core-desktop')
    const { resetWorkspacePolicyCache, setWorkspacePersonalMemoryRead } =
      await import('../agent-workspace-policy.store')
    resetWorkspacePolicyCache()

    const events: DomainMutationEvent[] = []
    const unsub = domainMutationBus.subscribe((event) => {
      events.push(event)
    })
    await setWorkspacePersonalMemoryRead('ws-1', false)
    unsub()

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: 'settings',
          action: 'update',
          meta: { key: WORKSPACE_PERSONAL_MEMORY_READ_POLICY_KEY }
        })
      ])
    )
  })
})
