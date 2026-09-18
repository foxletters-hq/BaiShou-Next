import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BaishouAgentGateConfig } from '@baishou/shared'
import { persistSecurityMode } from '../workbench-home-security.util'

const currentGate: BaishouAgentGateConfig = {
  exclusionList: [],
  allowlist: [],
  securityMode: 'auto_review'
}

describe('persistSecurityMode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should reuse the current gate config instead of fetching again', async () => {
    const saved = { ...currentGate, securityMode: 'full_access' as const }
    const getConfig = vi.fn()
    const setConfig = vi.fn().mockResolvedValue(saved)
    vi.stubGlobal('window', {
      api: {
        settings: {
          getBaishouAgentGateConfig: getConfig,
          setBaishouAgentGateConfig: setConfig
        }
      }
    })

    const result = await persistSecurityMode({
      workspaceId: 'ws-1',
      mode: 'full_access',
      currentGate
    })

    expect(getConfig).not.toHaveBeenCalled()
    expect(setConfig).toHaveBeenCalledWith(
      expect.objectContaining({ securityMode: 'full_access' }),
      { kind: 'workspace', workspaceId: 'ws-1' }
    )
    expect(result).toBe(saved)
  })

  it('should load the gate config when the caller has no cached copy', async () => {
    const saved = { ...currentGate, securityMode: 'allow_list' as const }
    const getConfig = vi.fn().mockResolvedValue(currentGate)
    const setConfig = vi.fn().mockResolvedValue(saved)
    vi.stubGlobal('window', {
      api: {
        settings: {
          getBaishouAgentGateConfig: getConfig,
          setBaishouAgentGateConfig: setConfig
        }
      }
    })

    await persistSecurityMode({
      workspaceId: 'ws-2',
      mode: 'allow_list',
      currentGate: null
    })

    expect(getConfig).toHaveBeenCalledWith({ kind: 'workspace', workspaceId: 'ws-2' })
    expect(setConfig).toHaveBeenCalledWith(
      expect.objectContaining({ securityMode: 'allow_list' }),
      {
        kind: 'workspace',
        workspaceId: 'ws-2'
      }
    )
  })
})
