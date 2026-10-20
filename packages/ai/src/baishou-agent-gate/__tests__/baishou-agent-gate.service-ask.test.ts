import { describe, expect, it, vi } from 'vitest'
import {
  AgentGateAlwaysNotAllowedError,
  AgentGateCancelledError,
  AgentGateCorrectedError,
  AgentGateDeniedError,
  AgentGateEffect,
  AgentGateKind,
  AgentGateReply
} from '@baishou/shared'
import { createBaishouAgentGate } from '../baishou-agent-gate.service'
import { baseAssertInput } from './baishou-agent-gate.test-helpers'

describe('BaishouAgentGateService', () => {
  it('assert 在 ask 时挂起，reply once 后继续', async () => {
    const { gate, eventBus } = createBaishouAgentGate({
      config: {
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

  it('reply always 把伙伴工具写成允许后同动作自动放行', async () => {
    const persist = vi.fn()
    const { gate, getConfig } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      },
      persistConfig: persist
    })

    const first = gate.assert(baseAssertInput)
    const [request] = gate.listPending()
    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Always })
    await first

    expect(getConfig().allowlist.some((e) => e.action === 'diary_edit')).toBe(false)
    expect(
      getConfig().permissionRules?.some(
        (rule) => rule.action === 'diary_edit' && rule.effect === AgentGateEffect.Allow
      )
    ).toBe(true)
    expect(persist).toHaveBeenCalledTimes(1)

    await expect(gate.assert(baseAssertInput)).resolves.toBeUndefined()
  })

  it('排除动作不能 always', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
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

  it('forceExclusion 元数据动作不能 always，即使不在 exclusionList', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const pending = gate.assert({
      ...baseAssertInput,
      action: 'workspace_delete',
      title: '删除工作区文件',
      metadata: { forceExclusion: true }
    })
    const [request] = gate.listPending()

    await expect(
      gate.reply({ requestId: request!.id, reply: AgentGateReply.Always })
    ).rejects.toBeInstanceOf(AgentGateAlwaysNotAllowedError)

    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Once })
    await pending
  })

  it('workspace_delete 可以始终允许并写入 allowlist', async () => {
    const { gate, getConfig } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const pending = gate.assert({
      ...baseAssertInput,
      action: 'workspace_delete',
      title: '删除工作区文件',
      metadata: { alwaysPatterns: ['*'], riskLevel: 'destructive' }
    })
    const [request] = gate.listPending()

    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Always })
    await pending
    expect(getConfig().allowlist.some((e) => e.action === 'workspace_delete')).toBe(true)
  })

  it('截断预览即使命中 allowlist 也强制 Ask，且拒绝 Always', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: [{ id: 'bagal_write', action: 'workspace_write', createdAt: 1 }]
      }
    })

    const pending = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写入工作区文件',
      preview: {
        type: 'file_change',
        path: 'a.txt',
        kind: 'modify',
        diff: '...',
        additions: 1,
        deletions: 0,
        truncated: true
      }
    })
    const [request] = gate.listPending()
    expect(request).toBeTruthy()

    await expect(
      gate.reply({ requestId: request!.id, reply: AgentGateReply.Always })
    ).rejects.toBeInstanceOf(AgentGateAlwaysNotAllowedError)

    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Once })
    await pending
  })

  it('危险命令预览拒绝 Always', async () => {
    const { gate } = createBaishouAgentGate()

    const pending = gate.assert({
      ...baseAssertInput,
      action: 'workspace_run',
      title: '运行命令',
      preview: {
        type: 'command',
        command: 'rm -rf /',
        workdir: '.',
        dangerous: true
      }
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
    expect((error as AgentGateCorrectedError).message).toContain('[用户纠正]')
    expect((error as AgentGateCorrectedError).message).toContain('请先说明要改哪一段')
  })

  it('deny 时不挂起直接失败', async () => {
    const { gate, policy } = createBaishouAgentGate()
    const evaluateDetailed = vi.spyOn(policy, 'evaluateDetailed').mockReturnValue({
      effect: AgentGateEffect.Deny,
      decisionSource: { layer: 'default', action: 'diary_edit', effect: AgentGateEffect.Deny }
    })

    await expect(gate.assert(baseAssertInput)).rejects.toBeInstanceOf(AgentGateDeniedError)
    expect(gate.listPending()).toHaveLength(0)
    evaluateDetailed.mockRestore()
  })

  it('cancelSession 取消挂起', async () => {
    const { gate } = createBaishouAgentGate()

    const pending = gate.assert(baseAssertInput).catch((e) => e)
    gate.cancelSession('sess_1', 'vault switch')

    const error = await pending
    expect(error).toBeInstanceOf(AgentGateCancelledError)
    expect(gate.listPending()).toHaveLength(0)
  })

  it('cancelSession 会广播 cancelled，让确认卡从收件箱消失', async () => {
    const { gate, eventBus } = createBaishouAgentGate()
    const cancelled: string[] = []
    const unsub = eventBus.subscribe((event) => {
      if (event.type === 'agent_gate.cancelled') {
        cancelled.push(...event.requestIds)
      }
    })

    const pending = gate
      .assert({
        ...baseAssertInput,
        kind: AgentGateKind.Proactive,
        action: 'companion_ask',
        title: '继续吗？'
      })
      .catch((error) => error)
    await Promise.resolve()
    gate.cancelSession('sess_1', 'stream aborted')

    expect(await pending).toBeInstanceOf(AgentGateCancelledError)
    expect(cancelled.length).toBe(1)
    expect(gate.listPending()).toHaveLength(0)
    unsub()
  })

  it('assertWithResolution 在 allow 时直接返回空 requestId', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: [],
        permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
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
})
