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

  it('migrates legacy FullTrust to catch-all allow rule and keeps safety toggles', () => {
    const patch = sanitizeBaishouAgentGateConfigPatch({
      trustMode: AgentGateTrustMode.FullTrust,
      hideDeniedTools: false,
      repeatAssertAskThreshold: 5
    } as never)
    expect(patch.permissionRules).toEqual(
      expect.arrayContaining([{ action: '*', effect: AgentGateEffect.Allow }])
    )
    expect((patch as { trustMode?: unknown }).trustMode).toBeUndefined()
    expect(patch.hideDeniedTools).toBe(false)
    expect(patch.repeatAssertAskThreshold).toBe(5)
  })

  it('migrates legacy external fields into external_directory rules', () => {
    const patch = sanitizeBaishouAgentGateConfigPatch({
      externalPathEffect: 'deny',
      trustedExternalDirs: [' D:/Notes ', '*', 'C:/Safe']
    } as never)
    expect(
      patch.permissionRules?.some(
        (rule) => rule.action === 'external_directory' && rule.effect === AgentGateEffect.Deny
      )
    ).toBe(true)
  })

  it('migrates trusted dirs into patterned Allow rules', () => {
    const patch = sanitizeBaishouAgentGateConfigPatch({
      externalPathEffect: 'allow',
      trustedExternalDirs: ['D:/Notes']
    } as never)
    expect(
      patch.permissionRules?.some(
        (rule) =>
          rule.action === 'external_directory' &&
          rule.pattern === 'D:/Notes/**' &&
          rule.effect === AgentGateEffect.Allow
      )
    ).toBe(true)
  })
})
