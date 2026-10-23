import { describe, expect, it } from 'vitest'
import { AgentGateEffect } from '../agent-gate.enums'
import {
  DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
  applyWorkspacePolicyPatch,
  cloneBaishouAgentGateConfig,
  resolveWorkspacePolicyFields
} from '../agent-gate.defaults'
import {
  applyCapabilityStateToConfig,
  capabilityStateFromConfig
} from '../agent-gate-capability.util'
import { hasCatchAllAllowRule } from '../agent-gate-migrate.util'

describe('workspace vs companion gate defaults', () => {
  it('uses safe Manual defaults for workspace and empty allowlist', () => {
    expect(hasCatchAllAllowRule(DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)).toBe(false)
    expect(DEFAULT_WORKSPACE_AGENT_GATE_CONFIG.allowlist).toEqual([])
    expect(DEFAULT_WORKSPACE_AGENT_GATE_CONFIG.exclusionList).not.toContain('workspace_delete')
    expect(DEFAULT_WORKSPACE_AGENT_GATE_CONFIG.exclusionList).not.toContain('diary_delete')
  })

  it('does not copy companion FullTrust into workspace clone defaults', () => {
    const companion = cloneBaishouAgentGateConfig({
      ...DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
      permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }],
      allowlist: [
        {
          id: 'bagal_1',
          action: 'diary_write',
          createdAt: 1
        }
      ]
    })
    const workspace = cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)
    expect(hasCatchAllAllowRule(companion)).toBe(true)
    expect(hasCatchAllAllowRule(workspace)).toBe(false)
    expect(workspace.allowlist).toEqual([])
  })

  it('companion capability matrix changes do not alter workspace defaults', () => {
    const companion = applyCapabilityStateToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_BAISHOU_AGENT_GATE_CONFIG),
      'companion',
      {
        effects: {
          browse: AgentGateEffect.Ask,
          edit: AgentGateEffect.Ask,
          delete: AgentGateEffect.Ask,
          command: AgentGateEffect.Ask,
          external: AgentGateEffect.Ask,
          diary_write: AgentGateEffect.Allow,
          diary_delete: AgentGateEffect.Ask,
          memory_store: AgentGateEffect.Allow,
          memory_delete: AgentGateEffect.Ask
        },
        trustedExternalDirs: []
      }
    )
    const workspace = cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)
    expect(capabilityStateFromConfig(companion, 'companion').effects.diary_write).toBe(
      AgentGateEffect.Allow
    )
    expect(capabilityStateFromConfig(workspace, 'workspace').effects.edit).toBe(AgentGateEffect.Ask)
    expect(workspace.permissionRules ?? []).not.toEqual(
      expect.arrayContaining([{ action: 'diary_write', effect: AgentGateEffect.Allow }])
    )
  })

  it('keeps personalMemoryReadEnabled when only toolManagement is patched', () => {
    const current = resolveWorkspacePolicyFields({
      personalMemoryReadEnabled: false,
      toolManagement: {
        disabledToolIds: ['workspace_run'],
        customConfigs: {}
      }
    })
    const afterTools = applyWorkspacePolicyPatch(current, {
      toolManagement: {
        disabledToolIds: [],
        customConfigs: {}
      }
    })
    expect(afterTools.personalMemoryReadEnabled).toBe(false)
    expect(afterTools.toolManagement.disabledToolIds).toEqual([])

    const afterFlag = applyWorkspacePolicyPatch(afterTools, {
      personalMemoryReadEnabled: true
    })
    expect(afterFlag.personalMemoryReadEnabled).toBe(true)
    expect(afterFlag.toolManagement.disabledToolIds).toEqual([])
  })
})
