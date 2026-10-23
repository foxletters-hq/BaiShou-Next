import { describe, expect, it, vi } from 'vitest'
import { AgentGateEffect, AgentGateKind, AgentGateProfileId, AgentGateReply } from '@baishou/shared'
import { BaishouAgentGateAllowlistStore } from '../baishou-agent-gate-allowlist.store'
import { createBaishouAgentGate } from '../baishou-agent-gate.service'

describe('Agent Gate profile + probeEffect', () => {
  it('companion profile denies workspace actions', () => {
    const { policy } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: [],
        permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
      }
    })

    expect(
      policy.evaluate({
        action: 'workspace_write',
        profileId: AgentGateProfileId.Companion
      })
    ).toBe(AgentGateEffect.Deny)
  })

  it('workspace profile denies diary and graph_upsert', () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: [],
        permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
      }
    })

    expect(
      gate.probeEffect({
        action: 'diary_edit',
        profileId: AgentGateProfileId.Workspace
      })
    ).toBe(AgentGateEffect.Deny)
    expect(
      gate.probeEffect({
        action: 'diary_write',
        profileId: AgentGateProfileId.Workspace
      })
    ).toBe(AgentGateEffect.Deny)
    expect(
      gate.probeEffect({
        action: 'diary_read',
        profileId: AgentGateProfileId.Workspace
      })
    ).toBe(AgentGateEffect.Allow)
    expect(
      gate.probeEffect({
        action: 'graph_upsert',
        profileId: AgentGateProfileId.Workspace
      })
    ).toBe(AgentGateEffect.Deny)
    expect(
      gate.probeEffect({
        action: 'workspace_write',
        profileId: AgentGateProfileId.Workspace
      })
    ).toBe(AgentGateEffect.Allow)
  })

  it('companion profile does not force Ask for recall_relations (G1.d / G-D4)', () => {
    // 只读图谱检索默认放行；用户可在设置里改为询问/拒绝
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: [],
        permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
      }
    })
    expect(
      gate.probeEffect({
        action: 'recall_relations',
        profileId: AgentGateProfileId.Companion
      })
    ).toBe(AgentGateEffect.Allow)
  })
})

describe('scoped gate config isolation', () => {
  it('companion FullTrust allowlist does not affect a separate workspace gate instance', async () => {
    const companion = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: [{ id: 'c1', action: 'diary_write', createdAt: 1 }],
        permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
      },
      configScope: { kind: 'companion' }
    })
    const workspace = createBaishouAgentGate({
      config: {
        exclusionList: ['workspace_delete'],
        allowlist: []
      },
      configScope: { kind: 'workspace', workspaceId: 'ws-a' }
    })

    expect(
      companion.policy.evaluate({
        action: 'diary_write',
        profileId: AgentGateProfileId.Companion
      })
    ).toBe(AgentGateEffect.Allow)

    expect(
      workspace.policy.evaluate({
        action: 'workspace_write',
        profileId: AgentGateProfileId.Workspace
      })
    ).toBe(AgentGateEffect.Ask)

    expect(workspace.getConfig().allowlist).toEqual([])
    expect(companion.getConfig().allowlist).toHaveLength(1)
  })

  it('publishes allowlist_changed with configScope', async () => {
    const events: Array<{ type: string; scope?: unknown }> = []
    const { gate, eventBus } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      },
      configScope: { kind: 'workspace', workspaceId: 'ws-b' }
    })
    eventBus.subscribe((event) => {
      if (event.type === 'agent_gate.allowlist_changed') {
        events.push(event)
      }
    })

    const assertPromise = gate.assert({
      sessionId: 's1',
      vaultName: 'Personal',
      kind: AgentGateKind.Tool,
      action: 'workspace_write',
      title: 'write',
      profileId: AgentGateProfileId.Workspace
    })
    await Promise.resolve()
    const pending = gate.listPending('s1')[0]
    expect(pending).toBeTruthy()
    await gate.reply({ requestId: pending!.id, reply: AgentGateReply.Always })
    await assertPromise

    expect(
      events.some((e) => (e as { scope?: { kind: string } }).scope?.kind === 'workspace')
    ).toBe(true)
  })
})

describe('BaishouAgentGateAllowlistStore', () => {
  it('add 重复动作不重复写入，remove 后可 persist', async () => {
    const persist = vi.fn()
    const config = {
      exclusionList: [],
      allowlist: [] as { id: string; action: string; createdAt: number }[]
    }
    const store = new BaishouAgentGateAllowlistStore(() => config, persist)

    const first = store.add({ action: 'diary_edit' })
    const second = store.add({ action: 'diary_edit' })
    expect(first.id).toBe(second.id)
    expect(config.allowlist).toHaveLength(1)

    await store.persist()
    expect(persist).toHaveBeenCalledTimes(1)

    expect(store.remove(first.id)).toBe(true)
    expect(config.allowlist).toHaveLength(0)
    await store.persist()
    expect(persist).toHaveBeenCalledTimes(2)
  })
})
