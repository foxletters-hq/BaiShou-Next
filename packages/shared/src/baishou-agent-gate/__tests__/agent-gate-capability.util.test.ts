import { describe, expect, it } from 'vitest'
import { AgentGateEffect, AgentGateTrustMode } from '../agent-gate.enums'
import {
  applyCapabilityStateToConfig,
  applyCapabilityToConfig,
  capabilityStateFromConfig
} from '../agent-gate-capability.util'
import {
  DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG
} from '../agent-gate.defaults'
import { cloneBaishouAgentGateConfig } from '../agent-gate.defaults'

describe('agent-gate-capability.util', () => {
  it('workspace defaults: browse allow, edit/command/external ask, delete locked ask', () => {
    const config = cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)
    const state = capabilityStateFromConfig(config, 'workspace')
    expect(state.effects.browse).toBe(AgentGateEffect.Allow)
    expect(state.effects.edit).toBe(AgentGateEffect.Ask)
    expect(state.effects.delete).toBe(AgentGateEffect.Ask)
    expect(state.effects.command).toBe(AgentGateEffect.Ask)
    expect(state.effects.external).toBe(AgentGateEffect.Ask)
  })

  it('round-trips edit allow and preserves custom advanced rules', () => {
    const config = cloneBaishouAgentGateConfig(
      {
        ...DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
        permissionRules: [
          { action: 'workspace_write', pattern: 'tmp/**', effect: AgentGateEffect.Deny }
        ]
      },
      DEFAULT_WORKSPACE_AGENT_GATE_CONFIG
    )

    const next = applyCapabilityToConfig(config, 'workspace', {
      capabilityId: 'edit',
      effect: AgentGateEffect.Allow
    })

    expect(next.permissionRules).toEqual(
      expect.arrayContaining([
        { action: 'workspace_write', effect: AgentGateEffect.Allow },
        { action: 'workspace_patch', effect: AgentGateEffect.Allow },
        { action: 'workspace_rename', effect: AgentGateEffect.Allow },
        { action: 'workspace_write', pattern: 'tmp/**', effect: AgentGateEffect.Deny }
      ])
    )

    const state = capabilityStateFromConfig(next, 'workspace')
    expect(state.effects.edit).toBe(AgentGateEffect.Allow)
  })

  it('keeps delete locked to ask even when patch requests allow', () => {
    const config = cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)
    const next = applyCapabilityToConfig(config, 'workspace', {
      capabilityId: 'delete',
      effect: AgentGateEffect.Allow
    })
    expect(capabilityStateFromConfig(next, 'workspace').effects.delete).toBe(AgentGateEffect.Ask)
    expect(next.exclusionList).toContain('workspace_delete')
    expect(
      next.permissionRules?.some(
        (rule) => rule.action === 'workspace_delete' && rule.effect === AgentGateEffect.Allow
      )
    ).toBe(false)
  })

  it('does not emit whole-action allow for command', () => {
    const config = cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)
    const next = applyCapabilityToConfig(config, 'workspace', {
      capabilityId: 'command',
      effect: AgentGateEffect.Allow
    })
    expect(
      next.permissionRules?.some(
        (rule) =>
          rule.action === 'workspace_run' && rule.effect === AgentGateEffect.Allow && !rule.pattern
      )
    ).toBe(false)
    expect(capabilityStateFromConfig(next, 'workspace').effects.command).toBe(AgentGateEffect.Ask)
  })

  it('compiles trusted external dirs and round-trips allow+dirs', () => {
    const config = cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)
    const next = applyCapabilityStateToConfig(config, 'workspace', {
      effects: {
        browse: AgentGateEffect.Allow,
        edit: AgentGateEffect.Ask,
        delete: AgentGateEffect.Ask,
        command: AgentGateEffect.Ask,
        external: AgentGateEffect.Allow,
        diary_write: AgentGateEffect.Ask,
        diary_delete: AgentGateEffect.Ask,
        memory_store: AgentGateEffect.Ask,
        memory_delete: AgentGateEffect.Ask
      },
      trustedExternalDirs: ['D:/Notes']
    })

    expect(next.externalPathEffect).toBe('allow')
    expect(next.forceAskExternalPath).toBe(true)
    expect(next.trustedExternalDirs).toEqual(['D:/Notes/**'])
    // 可信目录只写入 trustedExternalDirs，不编译成绕过编辑询问的 Allow 规则
    expect(
      next.permissionRules?.some(
        (rule) => rule.pattern === 'D:/Notes/**' && rule.effect === AgentGateEffect.Allow
      )
    ).toBe(false)

    const state = capabilityStateFromConfig(next, 'workspace')
    expect(state.effects.external).toBe(AgentGateEffect.Allow)
    expect(state.trustedExternalDirs).toEqual(['D:/Notes/**'])
  })

  it('external deny sets externalPathEffect', () => {
    const config = cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)
    const next = applyCapabilityToConfig(config, 'workspace', {
      capabilityId: 'external',
      effect: AgentGateEffect.Deny
    })
    expect(next.externalPathEffect).toBe('deny')
    expect(capabilityStateFromConfig(next, 'workspace').effects.external).toBe(AgentGateEffect.Deny)
  })

  it('legacy FullTrust maps unmanaged caps to allow on readback', () => {
    const config = cloneBaishouAgentGateConfig(
      {
        ...DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
        trustMode: AgentGateTrustMode.FullTrust
      },
      DEFAULT_WORKSPACE_AGENT_GATE_CONFIG
    )
    const state = capabilityStateFromConfig(config, 'workspace')
    expect(state.effects.browse).toBe(AgentGateEffect.Allow)
    expect(state.effects.edit).toBe(AgentGateEffect.Allow)
  })

  it('companion delete caps stay locked ask', () => {
    const config = cloneBaishouAgentGateConfig(null, DEFAULT_BAISHOU_AGENT_GATE_CONFIG)
    const next = applyCapabilityStateToConfig(config, 'companion', {
      effects: {
        browse: AgentGateEffect.Ask,
        edit: AgentGateEffect.Ask,
        delete: AgentGateEffect.Ask,
        command: AgentGateEffect.Ask,
        external: AgentGateEffect.Ask,
        diary_write: AgentGateEffect.Allow,
        diary_delete: AgentGateEffect.Allow,
        memory_store: AgentGateEffect.Allow,
        memory_delete: AgentGateEffect.Deny
      },
      trustedExternalDirs: []
    })
    const state = capabilityStateFromConfig(next, 'companion')
    expect(state.effects.diary_write).toBe(AgentGateEffect.Allow)
    expect(state.effects.diary_delete).toBe(AgentGateEffect.Ask)
    expect(state.effects.memory_store).toBe(AgentGateEffect.Allow)
    expect(state.effects.memory_delete).toBe(AgentGateEffect.Ask)
    expect(next.exclusionList).toEqual(expect.arrayContaining(['diary_delete', 'memory_delete']))
  })
})
