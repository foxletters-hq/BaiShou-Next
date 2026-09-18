import { describe, expect, it } from 'vitest'
import { AgentGateEffect, DEFAULT_WORKSPACE_COMMAND_BLACKLIST } from '@baishou/shared'
import {
  buildPermissionRule,
  capabilityEffectOptions,
  capabilityHint,
  capabilityTitle,
  clampRepeatAssertAskThreshold,
  effectLabel,
  movePermissionRule,
  nextExclusionList,
  nextTrustedDirs,
  normalizeTrustedDirDraft,
  resolveCommandBlacklist,
  resolveExclusionList,
  scopesMatch,
  workspaceCustomPresetPatch
} from '../agent-gate-settings.util'

const t = (key: string, fallback: string) => fallback

describe('scopesMatch', () => {
  it('should treat missing scopes as equal when both are absent', () => {
    expect(scopesMatch(undefined, undefined)).toBe(true)
    expect(scopesMatch(undefined, { kind: 'companion' })).toBe(false)
  })

  it('should require the same workspace id when both scopes are workspace', () => {
    expect(
      scopesMatch({ kind: 'workspace', workspaceId: 'a' }, { kind: 'workspace', workspaceId: 'a' })
    ).toBe(true)
    expect(
      scopesMatch({ kind: 'workspace', workspaceId: 'a' }, { kind: 'workspace', workspaceId: 'b' })
    ).toBe(false)
    expect(scopesMatch({ kind: 'companion' }, { kind: 'workspace', workspaceId: 'a' })).toBe(false)
  })
})

describe('capability copy', () => {
  it('should return the browse title and hint when the id is browse', () => {
    expect(capabilityTitle('browse', t)).toBe('读取')
    expect(capabilityHint('browse', t)).toContain('列出与读取')
  })

  it('should fall back to the raw id when the capability is unknown', () => {
    expect(capabilityTitle('not_a_cap' as 'browse', t)).toBe('not_a_cap')
    expect(capabilityHint('not_a_cap' as 'browse', t)).toBe('')
  })
})

describe('capabilityEffectOptions', () => {
  it('should lock the control to ask when the capability forbids other effects', () => {
    expect(capabilityEffectOptions({ lockedToAsk: true })).toEqual([AgentGateEffect.Ask])
  })

  it('should omit allow when the capability disallows a standing allow', () => {
    expect(capabilityEffectOptions({ disallowAllow: true })).toEqual([
      AgentGateEffect.Ask,
      AgentGateEffect.Deny
    ])
  })
})

describe('effectLabel', () => {
  it('should map allow ask and deny when translating effects', () => {
    expect(effectLabel(AgentGateEffect.Allow, t)).toBe('允许')
    expect(effectLabel(AgentGateEffect.Ask, t)).toBe('询问')
    expect(effectLabel(AgentGateEffect.Deny, t)).toBe('拒绝')
  })
})

describe('resolveCommandBlacklist', () => {
  it('should use the default blacklist when the config list is empty', () => {
    expect(resolveCommandBlacklist({ commandBlacklist: [] })).toEqual([
      ...DEFAULT_WORKSPACE_COMMAND_BLACKLIST
    ])
    expect(resolveCommandBlacklist({ commandBlacklist: ['rm -rf'] })).toEqual(['rm -rf'])
  })
})

describe('resolveExclusionList', () => {
  it('should use the companion fallback when the config omits the list', () => {
    const companion = resolveExclusionList({}, 'companion')
    const workspace = resolveExclusionList({}, 'workspace')
    expect(companion.length).toBeGreaterThan(0)
    expect(workspace).not.toEqual(companion)
    expect(resolveExclusionList({ exclusionList: ['workspace_run'] }, 'companion')).toEqual([
      'workspace_run'
    ])
  })
})

describe('nextExclusionList', () => {
  it('should reject an empty or duplicate draft when adding an exclusion', () => {
    expect(nextExclusionList(['workspace_run'], '   ')).toBe('empty')
    expect(nextExclusionList(['workspace_run'], 'workspace_run')).toBe('duplicate')
    expect(nextExclusionList(['workspace_run'], 'diary_delete')).toEqual([
      'workspace_run',
      'diary_delete'
    ])
  })
})

describe('trusted dirs', () => {
  it('should reject wildcards when normalizing a trusted directory draft', () => {
    expect(normalizeTrustedDirDraft('  D:\\Notes  ')).toBe('D:/Notes')
    expect(normalizeTrustedDirDraft('*')).toBeNull()
    expect(normalizeTrustedDirDraft('**/*')).toBeNull()
  })

  it('should append a new directory when the draft is unique', () => {
    expect(nextTrustedDirs(['D:/Notes'], 'D:/Notes')).toBe('duplicate')
    expect(nextTrustedDirs(['D:/Notes'], 'E:/Work')).toEqual(['D:/Notes', 'E:/Work'])
  })
})

describe('permission rules', () => {
  it('should omit the pattern when the draft is blank', () => {
    expect(buildPermissionRule('  ', AgentGateEffect.Ask, 'x')).toBeNull()
    expect(buildPermissionRule('workspace_run', AgentGateEffect.Deny, '  ')).toEqual({
      action: 'workspace_run',
      effect: AgentGateEffect.Deny
    })
    expect(buildPermissionRule('workspace_run', AgentGateEffect.Ask, 'git *')).toEqual({
      action: 'workspace_run',
      effect: AgentGateEffect.Ask,
      pattern: 'git *'
    })
  })

  it('should swap neighbors when moving a rule and ignore out-of-range deltas', () => {
    const rules = [
      { action: 'a', effect: AgentGateEffect.Ask },
      { action: 'b', effect: AgentGateEffect.Deny }
    ]
    expect(movePermissionRule(rules, 0, -1)).toBeNull()
    expect(movePermissionRule(rules, 0, 1)?.map((rule) => rule.action)).toEqual(['b', 'a'])
  })
})

describe('workspaceCustomPresetPatch', () => {
  it('should mark custom presets only when the scene is workspace', () => {
    expect(workspaceCustomPresetPatch('workspace')).toEqual({
      scopePreset: 'custom',
      approvalPreset: 'custom'
    })
    expect(workspaceCustomPresetPatch('companion')).toEqual({})
  })
})

describe('clampRepeatAssertAskThreshold', () => {
  it('should clamp to 0..20 when the input is finite', () => {
    expect(clampRepeatAssertAskThreshold(Number.NaN)).toBeNull()
    expect(clampRepeatAssertAskThreshold(-3.2)).toBe(0)
    expect(clampRepeatAssertAskThreshold(21.8)).toBe(20)
    expect(clampRepeatAssertAskThreshold(4.9)).toBe(4)
  })
})
