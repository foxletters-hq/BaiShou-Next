import { describe, expect, it } from 'vitest'
import { AgentGateEffect, AgentGateProfileId } from '../agent-gate.enums'
import { getAgentGateProfileRules, resolveAgentGateProfileId } from '../agent-gate-profile.util'

describe('agent-gate-profile.util', () => {
  it('resolves profile ids', () => {
    expect(resolveAgentGateProfileId('workspace')).toBe(AgentGateProfileId.Workspace)
    expect(resolveAgentGateProfileId('companion')).toBe(AgentGateProfileId.Companion)
    expect(resolveAgentGateProfileId(undefined)).toBe(AgentGateProfileId.Companion)
  })

  it('companion rules deny workspace actions', () => {
    const rules = getAgentGateProfileRules(AgentGateProfileId.Companion)
    expect(rules.some((r) => r.action === 'workspace_*' && r.effect === AgentGateEffect.Deny)).toBe(
      true
    )
  })

  it('workspace rules deny diary writes while allowing known diary reads', () => {
    const rules = getAgentGateProfileRules(AgentGateProfileId.Workspace)
    const actions = rules.map((r) => r.action)
    expect(actions).toContain('diary_*')
    expect(actions).toContain('diary_read')
    expect(actions).toContain('diary_list')
    expect(actions).toContain('diary_search')
    expect(actions).toContain('memory_*')
    expect(actions).toContain('graph_upsert')
    expect(
      rules.some((r) => r.action === 'diary_read' && r.effect === AgentGateEffect.Allow)
    ).toBe(true)
    expect(
      rules.some((r) => r.action === 'diary_*' && r.effect === AgentGateEffect.Deny)
    ).toBe(true)
  })
})
