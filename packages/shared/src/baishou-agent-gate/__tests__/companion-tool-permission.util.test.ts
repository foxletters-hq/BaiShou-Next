import { describe, expect, it } from 'vitest'
import { AgentGateEffect } from '../agent-gate.enums'
import {
  companionToolEffectOptions,
  nextDisabledToolIdsForEffect,
  resolveCompanionToolEffect
} from '../companion-tool-permission.util'

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
})
