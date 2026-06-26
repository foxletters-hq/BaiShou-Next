import { describe, expect, it } from 'vitest'
import { AgentGateEffect } from '../agent-gate.enums'
import {
  agentGateActionPatternMatch,
  agentGateGlobMatch,
  agentGateResourcePatternMatch,
  combineAgentGateRuleEffects,
  evaluateAgentGatePermissionRules,
  resolveAgentGatePermissionRules
} from '../agent-gate-ruleset.util'

describe('agent-gate-ruleset.util', () => {
  describe('agentGateGlobMatch', () => {
    it('matches exact paths', () => {
      expect(agentGateGlobMatch('src/foo.ts', 'src/foo.ts')).toBe(true)
      expect(agentGateGlobMatch('src/foo.ts', 'src/bar.ts')).toBe(false)
    })

    it('matches single-segment wildcards', () => {
      expect(agentGateGlobMatch('src/*.ts', 'src/foo.ts')).toBe(true)
      expect(agentGateGlobMatch('src/*.ts', 'src/nested/foo.ts')).toBe(false)
    })

    it('matches recursive wildcards', () => {
      expect(agentGateGlobMatch('**/*.ts', 'src/foo.ts')).toBe(true)
      expect(agentGateGlobMatch('**/*.ts', 'deep/nested/foo.ts')).toBe(true)
    })
  })

  describe('agentGateActionPatternMatch', () => {
    it('matches action wildcards', () => {
      expect(agentGateActionPatternMatch('workspace_*', 'workspace_write')).toBe(true)
      expect(agentGateActionPatternMatch('workspace_*', 'diary_write')).toBe(false)
      expect(agentGateActionPatternMatch('*', 'any_action')).toBe(true)
    })
  })

  describe('combineAgentGateRuleEffects', () => {
    it('prefers deny over ask over allow', () => {
      expect(
        combineAgentGateRuleEffects([
          AgentGateEffect.Allow,
          AgentGateEffect.Ask,
          AgentGateEffect.Deny
        ])
      ).toBe(AgentGateEffect.Deny)

      expect(
        combineAgentGateRuleEffects([AgentGateEffect.Allow, AgentGateEffect.Ask])
      ).toBe(AgentGateEffect.Ask)
    })
  })

  describe('evaluateAgentGatePermissionRules', () => {
    const resources = [{ kind: 'workspace_path' as const, value: 'src/foo.ts' }]

    it('returns undefined when no rule matches', () => {
      expect(
        evaluateAgentGatePermissionRules({
          action: 'workspace_write',
          resources,
          rules: [{ action: 'diary_*', effect: AgentGateEffect.Allow }]
        })
      ).toBeUndefined()
    })

    it('matches action-only rules without resources', () => {
      expect(
        evaluateAgentGatePermissionRules({
          action: 'diary_edit',
          resources: [],
          rules: [{ action: 'diary_edit', effect: AgentGateEffect.Allow }]
        })
      ).toBe(AgentGateEffect.Allow)
    })

    it('matches pattern rules against resources', () => {
      expect(
        evaluateAgentGatePermissionRules({
          action: 'workspace_write',
          resources,
          rules: [
            { action: 'workspace_write', pattern: 'src/**', effect: AgentGateEffect.Allow }
          ]
        })
      ).toBe(AgentGateEffect.Allow)

      expect(
        evaluateAgentGatePermissionRules({
          action: 'workspace_write',
          resources: [{ kind: 'workspace_path', value: 'docs/readme.md' }],
          rules: [
            { action: 'workspace_write', pattern: 'src/**', effect: AgentGateEffect.Allow }
          ]
        })
      ).toBeUndefined()
    })

    it('applies deny > ask > allow precedence across matches', () => {
      expect(
        evaluateAgentGatePermissionRules({
          action: 'workspace_write',
          resources,
          rules: [
            { action: 'workspace_*', pattern: '**/*', effect: AgentGateEffect.Allow },
            { action: 'workspace_write', pattern: 'src/**', effect: AgentGateEffect.Ask },
            { action: 'workspace_write', pattern: 'src/*.ts', effect: AgentGateEffect.Deny }
          ]
        })
      ).toBe(AgentGateEffect.Deny)
    })

    it('clamps allow to ask for force-excluded actions', () => {
      expect(
        evaluateAgentGatePermissionRules({
          action: 'workspace_delete',
          resources: [{ kind: 'workspace_path', value: 'src/foo.ts' }],
          rules: [
            { action: 'workspace_delete', pattern: '**/*', effect: AgentGateEffect.Allow }
          ],
          forceExcluded: true
        })
      ).toBe(AgentGateEffect.Ask)
    })
  })

  describe('resolveAgentGatePermissionRules', () => {
    it('derives actionRules when permissionRules are absent', () => {
      expect(
        resolveAgentGatePermissionRules({
          actionRules: { diary_edit: AgentGateEffect.Allow }
        })
      ).toEqual([{ action: 'diary_edit', effect: AgentGateEffect.Allow }])
    })

    it('prefers explicit permissionRules over derived actionRules', () => {
      expect(
        resolveAgentGatePermissionRules({
          actionRules: { diary_edit: AgentGateEffect.Allow },
          permissionRules: [{ action: 'diary_edit', effect: AgentGateEffect.Ask }]
        })
      ).toEqual([{ action: 'diary_edit', effect: AgentGateEffect.Ask }])
    })
  })

  describe('agentGateResourcePatternMatch', () => {
    it('matches any provided resource value', () => {
      expect(
        agentGateResourcePatternMatch('src/**', [
          { kind: 'workspace_path', value: 'docs/readme.md' },
          { kind: 'workspace_path', value: 'src/foo.ts' }
        ])
      ).toBe(true)
    })
  })
})
