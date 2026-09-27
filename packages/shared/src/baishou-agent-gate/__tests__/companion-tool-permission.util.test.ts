import { describe, expect, it } from 'vitest'
import { AgentGateEffect } from '../agent-gate.enums'
import {
  applyCompanionAlwaysAllow,
  companionToolEffectOptions,
  foldCompanionAllowlistIntoCapabilities,
  nextDisabledToolIdsForEffect,
  resolveCompanionToolEffect,
  stripCompanionAllowlistActions
} from '../companion-tool-permission.util'
import { capabilityStateFromConfig } from '../agent-gate-capability.util'
import {
  cloneBaishouAgentGateConfig,
  DEFAULT_BAISHOU_AGENT_GATE_CONFIG
} from '../agent-gate.defaults'

describe('companion-tool-permission.util', () => {
  it('adds and removes disabled ids from Deny', () => {
    expect(nextDisabledToolIdsForEffect([], 'skill_write', AgentGateEffect.Deny)).toEqual([
      'skill_write'
    ])
    expect(
      nextDisabledToolIdsForEffect(['skill_write'], 'skill_write', AgentGateEffect.Ask)
    ).toEqual([])
  })

  it('treats disabledToolIds as Deny before capability defaults', () => {
    expect(resolveCompanionToolEffect('skill_write', ['skill_write'], { effects: {} })).toBe(
      AgentGateEffect.Deny
    )
    expect(resolveCompanionToolEffect('skill_write', [], { effects: {} })).toBe(AgentGateEffect.Ask)
    expect(
      resolveCompanionToolEffect('skill_write', [], {
        effects: { skill_write: AgentGateEffect.Allow }
      })
    ).toBe(AgentGateEffect.Allow)
  })

  it('uses Allow/Deny only for UI-only auto inject time', () => {
    expect(companionToolEffectOptions('auto_inject_time')).toEqual([
      AgentGateEffect.Allow,
      AgentGateEffect.Deny
    ])
    expect(companionToolEffectOptions('skill_write')).toContain(AgentGateEffect.Ask)
  })

  it('should fold whole-tool companion allowlist entries into Allow capabilities', () => {
    const config = cloneBaishouAgentGateConfig(
      {
        ...DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
        allowlist: [
          { id: 'bagal_edit', action: 'diary_edit', createdAt: 1 },
          { id: 'bagal_run', action: 'workspace_run', createdAt: 2, pattern: 'git status *' }
        ]
      },
      DEFAULT_BAISHOU_AGENT_GATE_CONFIG
    )

    const folded = foldCompanionAllowlistIntoCapabilities(config)

    expect(capabilityStateFromConfig(folded, 'companion').effects.diary_edit).toBe(
      AgentGateEffect.Allow
    )
    expect(folded.allowlist).toEqual([
      expect.objectContaining({ action: 'workspace_run', pattern: 'git status *' })
    ])
  })

  it('should write companion Always as Allow and strip that action from allowlist', () => {
    const config = cloneBaishouAgentGateConfig(
      {
        ...DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
        allowlist: [{ id: 'bagal_edit', action: 'diary_edit', createdAt: 1 }]
      },
      DEFAULT_BAISHOU_AGENT_GATE_CONFIG
    )

    const next = applyCompanionAlwaysAllow(config, 'diary_edit')

    expect(next).not.toBeNull()
    expect(capabilityStateFromConfig(next!, 'companion').effects.diary_edit).toBe(
      AgentGateEffect.Allow
    )
    expect(next!.allowlist.some((entry) => entry.action === 'diary_edit')).toBe(false)
    expect(applyCompanionAlwaysAllow(config, 'workspace_write')).toBeNull()
  })

  it('should strip matching companion allowlist entries without changing other actions', () => {
    const config = cloneBaishouAgentGateConfig(
      {
        ...DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
        allowlist: [
          { id: 'bagal_edit', action: 'diary_edit', createdAt: 1 },
          { id: 'bagal_store', action: 'memory_store', createdAt: 2 }
        ]
      },
      DEFAULT_BAISHOU_AGENT_GATE_CONFIG
    )

    expect(stripCompanionAllowlistActions(config, ['diary_edit']).allowlist).toEqual([
      expect.objectContaining({ action: 'memory_store' })
    ])
  })
})
