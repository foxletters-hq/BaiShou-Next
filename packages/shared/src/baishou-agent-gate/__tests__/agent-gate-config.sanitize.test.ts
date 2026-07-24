import { describe, expect, it } from 'vitest'
import { AgentGateEffect, AgentGateTrustMode } from '../agent-gate.enums'
import { sanitizeBaishouAgentGateConfigPatch } from '../agent-gate-config.sanitize'

describe('sanitizeBaishouAgentGateConfigPatch', () => {
  it('rejects whole-action Allow for workspace_run', () => {
    const patch = sanitizeBaishouAgentGateConfigPatch({
      permissionRules: [
        { action: 'workspace_run', effect: AgentGateEffect.Allow },
        { action: 'workspace_write', effect: AgentGateEffect.Ask }
      ]
    })
    expect(patch.permissionRules).toEqual([
      { action: 'workspace_write', effect: AgentGateEffect.Ask }
    ])
  })

  it('rejects wildcard allowlist patterns and bare workspace_run', () => {
    const patch = sanitizeBaishouAgentGateConfigPatch({
      allowlist: [
        { id: 'a', action: 'workspace_run', createdAt: 1 },
        { id: 'b', action: 'workspace_run', createdAt: 2, pattern: '*' },
        {
          id: 'c',
          action: 'workspace_run',
          createdAt: 3,
          pattern: 'git status *',
          resourceKind: 'shell_command'
        }
      ]
    })
    expect(patch.allowlist).toHaveLength(1)
    expect(patch.allowlist?.[0]?.pattern).toBe('git status *')
  })

  it('keeps trust mode and safety toggles', () => {
    const patch = sanitizeBaishouAgentGateConfigPatch({
      trustMode: AgentGateTrustMode.FullTrust,
      hideDeniedTools: false,
      forceAskExternalPath: true,
      repeatAssertAskThreshold: 5
    })
    expect(patch.trustMode).toBe(AgentGateTrustMode.FullTrust)
    expect(patch.hideDeniedTools).toBe(false)
    expect(patch.forceAskExternalPath).toBe(true)
    expect(patch.repeatAssertAskThreshold).toBe(5)
  })

  it('sanitizes external path effect and trusted dirs', () => {
    const patch = sanitizeBaishouAgentGateConfigPatch({
      externalPathEffect: 'deny',
      trustedExternalDirs: [' D:/Notes ', '*', 'C:/Safe']
    })
    expect(patch.externalPathEffect).toBe('deny')
    expect(patch.forceAskExternalPath).toBe(true)
    expect(patch.trustedExternalDirs).toEqual(['D:/Notes', 'C:/Safe'])
  })
})
