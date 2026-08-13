import { describe, expect, it } from 'vitest'
import { AgentGateEffect } from '../agent-gate.enums'
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
  it('workspace defaults: browse allow, edit/command/external/delete ask', () => {
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

  it('allows delete capability to be set to allow', () => {
    const config = cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)
    const next = applyCapabilityToConfig(config, 'workspace', {
      capabilityId: 'delete',
      effect: AgentGateEffect.Allow
    })
    expect(capabilityStateFromConfig(next, 'workspace').effects.delete).toBe(AgentGateEffect.Allow)
    expect(next.exclusionList).not.toContain('workspace_delete')
    expect(
      next.permissionRules?.some(
        (rule) => rule.action === 'workspace_delete' && rule.effect === AgentGateEffect.Allow
      )
    ).toBe(true)
  })

  it('strips legacy workspace_delete from exclusion list on rebuild', () => {
    const config = cloneBaishouAgentGateConfig(
      {
        ...DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
        exclusionList: ['workspace_delete']
      },
      DEFAULT_WORKSPACE_AGENT_GATE_CONFIG
    )
    const next = applyCapabilityToConfig(config, 'workspace', {
      capabilityId: 'browse',
      effect: AgentGateEffect.Allow
    })
    expect(next.exclusionList).not.toContain('workspace_delete')
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

  it('compiles trusted external dirs into external_directory Allow rules', () => {
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

    expect(
      next.permissionRules?.some(
        (rule) =>
          rule.action === 'external_directory' &&
          rule.pattern === 'D:/Notes/**' &&
          rule.effect === AgentGateEffect.Allow
      )
    ).toBe(true)
    // 可信目录不编译成 workspace_write Allow，编辑仍询问
    expect(
      next.permissionRules?.some(
        (rule) =>
          rule.action === 'workspace_write' &&
          rule.pattern === 'D:/Notes/**' &&
          rule.effect === AgentGateEffect.Allow
      )
    ).toBe(false)

    const state = capabilityStateFromConfig(next, 'workspace')
    expect(state.effects.external).toBe(AgentGateEffect.Allow)
    expect(state.trustedExternalDirs).toEqual(['D:/Notes/**'])
  })

  it('external deny writes external_directory Deny rule', () => {
    const config = cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)
    const next = applyCapabilityToConfig(config, 'workspace', {
      capabilityId: 'external',
      effect: AgentGateEffect.Deny
    })
    expect(
      next.permissionRules?.some(
        (rule) =>
          rule.action === 'external_directory' &&
          rule.effect === AgentGateEffect.Deny &&
          !rule.pattern
      )
    ).toBe(true)
    expect(capabilityStateFromConfig(next, 'workspace').effects.external).toBe(AgentGateEffect.Deny)
  })

  it('catch-all allow rule maps unmanaged caps to allow on readback', () => {
    const config = cloneBaishouAgentGateConfig(
      {
        ...DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
        permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
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
