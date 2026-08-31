import { describe, expect, it } from 'vitest'
import { AgentGateEffect } from '../agent-gate.enums'
import {
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
  cloneBaishouAgentGateConfig
} from '../agent-gate.defaults'
import {
  applyWorkspaceSecurityModeToConfig,
  matchesCommandBlacklist,
  resolveWorkspaceSecurityMode,
  sortPermissionRulesForLastMatch
} from '../agent-gate-preset.util'
import { hasCatchAllAllowRule } from '../agent-gate-migrate.util'

describe('agent-gate-preset.util (security modes)', () => {
  it('allow_list has no catch-all and keeps edit as ask default', () => {
    const next = applyWorkspaceSecurityModeToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      'allow_list'
    )
    expect(next.securityMode).toBe('allow_list')
    expect(hasCatchAllAllowRule(next)).toBe(false)
    const rules = next.permissionRules ?? []
    expect(rules.some((rule) => rule.action === 'workspace_write')).toBe(false)
  })

  it('full_access adds catch-all allow', () => {
    const next = applyWorkspaceSecurityModeToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      'full_access'
    )
    expect(next.securityMode).toBe('full_access')
    expect(hasCatchAllAllowRule(next)).toBe(true)
  })

  it('auto_review allows edit without catch-all', () => {
    const next = applyWorkspaceSecurityModeToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      'auto_review'
    )
    expect(next.securityMode).toBe('auto_review')
    expect(hasCatchAllAllowRule(next)).toBe(false)
    const rules = next.permissionRules ?? []
    expect(
      rules.some(
        (rule) => rule.action === 'workspace_write' && rule.effect === AgentGateEffect.Allow
      )
    ).toBe(true)
  })

  it('resolveWorkspaceSecurityMode defaults to auto_review', () => {
    expect(resolveWorkspaceSecurityMode(undefined)).toBe('auto_review')
    expect(
      resolveWorkspaceSecurityMode({
        ...cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
        securityMode: 'full_access'
      })
    ).toBe('full_access')
  })

  it('matchesCommandBlacklist catches rm -rf', () => {
    expect(matchesCommandBlacklist('rm -rf /tmp/x', undefined)).toBe(true)
    expect(matchesCommandBlacklist('git status', undefined)).toBe(false)
  })

  it('sortPermissionRulesForLastMatch keeps pattern rules after bare', () => {
    const sorted = sortPermissionRulesForLastMatch([
      { action: 'workspace_run', pattern: 'git *', effect: AgentGateEffect.Allow },
      { action: 'workspace_run', effect: AgentGateEffect.Ask }
    ])
    expect(sorted[0]?.pattern).toBeUndefined()
    expect(sorted[1]?.pattern).toBe('git *')
  })
})
