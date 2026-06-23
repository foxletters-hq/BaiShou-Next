import { describe, it, expect, vi } from 'vitest'
import {
  AgentGateEffect,
  AgentGateKind,
  AgentGateReply,
  AgentGateTrustMode,
  AgentGateDeniedError,
  AgentGateAlwaysNotAllowedError,
  AgentGateCancelledError,
  AgentGateCorrectedError,
  AgentGateRejectedError
} from '@baishou/shared'
import { BaishouAgentGatePolicyService } from '../baishou-agent-gate-policy.service'
import { BaishouAgentGateAllowlistStore } from '../baishou-agent-gate-allowlist.store'
import { createBaishouAgentGate } from '../baishou-agent-gate.service'

const baseAssertInput = {
  sessionId: 'sess_1',
  vaultName: 'Personal',
  kind: AgentGateKind.Tool,
  action: 'diary_edit',
  title: '编辑日记'
}

describe('BaishouAgentGatePolicyService', () => {
  it('manual 模式默认 ask', () => {
    const config = {
      trustMode: AgentGateTrustMode.Manual,
      exclusionList: ['diary_delete'],
      allowlist: []
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(policy.evaluate({ action: 'diary_edit' })).toBe(AgentGateEffect.Ask)
  })

  it('full_trust 放行非排除动作', () => {
    const config = {
      trustMode: AgentGateTrustMode.FullTrust,
      exclusionList: ['diary_delete'],
      allowlist: []
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(policy.evaluate({ action: 'diary_edit' })).toBe(AgentGateEffect.Allow)
  })

  it('排除列表在 full_trust 下仍 ask', () => {
    const config = {
      trustMode: AgentGateTrustMode.FullTrust,
      exclusionList: ['diary_delete'],
      allowlist: []
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(policy.evaluate({ action: 'diary_delete' })).toBe(AgentGateEffect.Ask)
  })

  it('allowlist 命中则 allow', () => {
    const config = {
      trustMode: AgentGateTrustMode.Manual,
      exclusionList: [],
      allowlist: [{ id: 'bagal_1', action: 'diary_write', createdAt: 1 }]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(policy.evaluate({ action: 'diary_write' })).toBe(AgentGateEffect.Allow)
  })

  it('disabled 工具 deny', () => {
    const config = {
      trustMode: AgentGateTrustMode.Manual,
      exclusionList: [],
      allowlist: []
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(policy.evaluate({ action: 'diary_edit', toolDisabled: true })).toBe(
      AgentGateEffect.Deny
    )
  })
})

describe('BaishouAgentGateService', () => {
  it('assert 在 ask 时挂起，reply once 后继续', async () => {
    const { gate, eventBus } = createBaishouAgentGate({
      config: {
        trustMode: AgentGateTrustMode.Manual,
        exclusionList: [],
        allowlist: []
      }
    })

    const asked = vi.fn()
    eventBus.subscribe((event) => {
      if (event.type === 'agent_gate.asked') asked(event.request.id)
    })

    let settled = false
    const pending = gate.assert(baseAssertInput).then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(asked).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)

    const [request] = gate.listPending('sess_1')
    expect(request?.action).toBe('diary_edit')

    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Once })
    await pending
    expect(settled).toBe(true)
  })

  it('reply always 写入 allowlist 后同动作自动放行', async () => {
    const persist = vi.fn()
    const { gate, getConfig } = createBaishouAgentGate({
      config: {
        trustMode: AgentGateTrustMode.Manual,
        exclusionList: [],
        allowlist: []
      },
      persistConfig: persist
    })

    const first = gate.assert(baseAssertInput)
    const [request] = gate.listPending()
    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Always })
    await first

    expect(getConfig().allowlist.some((e) => e.action === 'diary_edit')).toBe(true)
    expect(persist).toHaveBeenCalledTimes(1)

    await expect(gate.assert(baseAssertInput)).resolves.toBeUndefined()
  })

  it('排除动作不能 always', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        trustMode: AgentGateTrustMode.Manual,
        exclusionList: ['diary_delete'],
        allowlist: []
      }
    })

    const pending = gate.assert({
      ...baseAssertInput,
      action: 'diary_delete',
      title: '删除日记'
    })
    const [request] = gate.listPending()

    await expect(
      gate.reply({ requestId: request!.id, reply: AgentGateReply.Always })
    ).rejects.toBeInstanceOf(AgentGateAlwaysNotAllowedError)

    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Once })
    await pending
  })

  it('reject 附带 message 时抛出 CorrectedError', async () => {
    const { gate } = createBaishouAgentGate()

    const pending = gate.assert(baseAssertInput).catch((e) => e)
    const [request] = gate.listPending()

    await gate.reply({
      requestId: request!.id,
      reply: AgentGateReply.Reject,
      message: '请先说明要改哪一段'
    })

    const error = await pending
    expect(error).toBeInstanceOf(AgentGateCorrectedError)
    expect((error as AgentGateCorrectedError).feedback).toBe('请先说明要改哪一段')
  })

  it('deny 时不挂起直接失败', async () => {
    const { gate, policy } = createBaishouAgentGate()
    const evaluate = vi.spyOn(policy, 'evaluate').mockReturnValue(AgentGateEffect.Deny)

    await expect(gate.assert(baseAssertInput)).rejects.toBeInstanceOf(AgentGateDeniedError)
    expect(gate.listPending()).toHaveLength(0)
    evaluate.mockRestore()
  })

  it('cancelSession 取消挂起', async () => {
    const { gate } = createBaishouAgentGate()

    const pending = gate.assert(baseAssertInput).catch((e) => e)
    gate.cancelSession('sess_1', 'vault switch')

    const error = await pending
    expect(error).toBeInstanceOf(AgentGateCancelledError)
    expect(gate.listPending()).toHaveLength(0)
  })

  it('assertWithResolution 在 allow 时直接返回空 requestId', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        trustMode: AgentGateTrustMode.FullTrust,
        exclusionList: [],
        allowlist: []
      }
    })

    const resolution = await gate.assertWithResolution(baseAssertInput)
    expect(resolution.requestId).toBe('')
    expect(resolution.reply).toBe(AgentGateReply.Once)
    expect(gate.listPending()).toHaveLength(0)
  })

  it('assertWithResolution 返回选项与自定义消息', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        trustMode: AgentGateTrustMode.Manual,
        exclusionList: [],
        allowlist: []
      }
    })

    const pending = gate.assertWithResolution({
      ...baseAssertInput,
      kind: AgentGateKind.Proactive,
      action: 'companion_ask',
      title: '选哪个？',
      options: [
        { id: '0', label: 'A' },
        { id: '1', label: 'B' }
      ],
      allowCustomInput: true
    })

    const [request] = gate.listPending('sess_1')
    await gate.reply({
      requestId: request!.id,
      reply: AgentGateReply.Once,
      selectedOptionIds: ['1'],
      message: '备注'
    })

    const resolution = await pending
    expect(resolution.selectedOptionIds).toEqual(['1'])
    expect(resolution.message).toBe('备注')
    expect(resolution.reply).toBe(AgentGateReply.Once)
  })

  it('reject 级联取消同 session 其他挂起请求', async () => {
    const { gate } = createBaishouAgentGate()

    const first = gate.assert(baseAssertInput).catch((e) => e)
    const second = gate
      .assert({ ...baseAssertInput, action: 'diary_write', title: '写日记' })
      .catch((e) => e)

    const pending = gate.listPending('sess_1')
    expect(pending).toHaveLength(2)

    await gate.reply({
      requestId: pending[0]!.id,
      reply: AgentGateReply.Reject
    })

    const firstError = await first
    const secondError = await second
    expect(firstError).toBeInstanceOf(AgentGateRejectedError)
    expect(secondError).toBeInstanceOf(AgentGateRejectedError)
    expect(gate.listPending('sess_1')).toHaveLength(0)
  })
})

describe('BaishouAgentGateAllowlistStore', () => {
  it('add 重复动作不重复写入，remove 后可 persist', async () => {
    const persist = vi.fn()
    const config = {
      trustMode: AgentGateTrustMode.Manual,
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
