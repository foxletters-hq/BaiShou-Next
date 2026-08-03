import { describe, expect, it } from 'vitest'
import { AgentGateEffect } from '../agent-gate.enums'
import {
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
  cloneBaishouAgentGateConfig
} from '../agent-gate.defaults'
import {
  applyWorkspacePresetsToConfig,
  inferWorkspacePresets,
  markWorkspacePresetsCustom,
  sortPermissionRulesForLastMatch
} from '../agent-gate-preset.util'
import { hasCatchAllAllowRule } from '../agent-gate-migrate.util'

describe('agent-gate-preset.util', () => {
  it('expands workspace_write + always_ask without catch-all allow', () => {
    const next = applyWorkspacePresetsToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      { scopePreset: 'workspace_write', approvalPreset: 'always_ask' }
    )
    expect(next.scopePreset).toBe('workspace_write')
    expect(next.approvalPreset).toBe('always_ask')
    expect(hasCatchAllAllowRule(next)).toBe(false)
    const rules = next.permissionRules ?? []
    // Ask 是默认效果，能力编译器不会落盘 Ask 规则
    expect(rules.some((rule) => rule.action === 'workspace_write')).toBe(false)
    expect(
      rules.some(
        (rule) => rule.action === 'external_directory' && rule.effect === AgentGateEffect.Deny
      )
    ).toBe(true)
  })

  it('never_ask adds catch-all allow while keeping delete ask via clamp/exclusion', () => {
    const next = applyWorkspacePresetsToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      { scopePreset: 'workspace_write', approvalPreset: 'never_ask' }
    )
    expect(hasCatchAllAllowRule(next)).toBe(true)
    expect(next.approvalPreset).toBe('never_ask')
  })

  it('dangerous_only allows edit but not catch-all', () => {
    const next = applyWorkspacePresetsToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      { scopePreset: 'workspace_write', approvalPreset: 'dangerous_only' }
    )
    expect(hasCatchAllAllowRule(next)).toBe(false)
    expect(next.permissionRules).toEqual(
      expect.arrayContaining([{ action: 'workspace_write', effect: AgentGateEffect.Allow }])
    )
  })

  it('markWorkspacePresetsCustom forces custom labels', () => {
    const next = markWorkspacePresetsCustom(
      applyWorkspacePresetsToConfig(
        cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
        { scopePreset: 'readonly', approvalPreset: 'always_ask' }
      )
    )
    expect(next.scopePreset).toBe('custom')
    expect(next.approvalPreset).toBe('custom')
  })

  it('sortPermissionRulesForLastMatch puts pattern rules after action-only', () => {
    const sorted = sortPermissionRulesForLastMatch([
      { action: 'workspace_run', pattern: 'git status *', effect: AgentGateEffect.Allow },
      { action: 'workspace_run', effect: AgentGateEffect.Ask }
    ])
    expect(sorted[0]?.pattern).toBeUndefined()
    expect(sorted[1]?.pattern).toBe('git status *')
  })

  it('with_trusted_dirs and empty dirs stays labeled, does not write bare external allow', () => {
    const next = applyWorkspacePresetsToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      { scopePreset: 'with_trusted_dirs', approvalPreset: 'always_ask' },
      []
    )
    expect(next.scopePreset).toBe('with_trusted_dirs')
    expect(next.approvalPreset).toBe('always_ask')
    expect(
      (next.permissionRules ?? []).some(
        (rule) =>
          rule.action === 'external_directory' &&
          rule.effect === AgentGateEffect.Allow &&
          !rule.pattern
      )
    ).toBe(false)
    const inferred = inferWorkspacePresets(next)
    expect(inferred.scopePreset).toBe('with_trusted_dirs')
    expect(inferred.approvalPreset).toBe('always_ask')
  })

  it('infer keeps stored with_trusted_dirs even when approvalPreset missing', () => {
    const config = applyWorkspacePresetsToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      { scopePreset: 'with_trusted_dirs', approvalPreset: 'always_ask' },
      []
    )
    delete config.approvalPreset
    const inferred = inferWorkspacePresets(config)
    expect(inferred.scopePreset).toBe('with_trusted_dirs')
  })
})
