import { describe, expect, it, vi } from 'vitest'
import {
  AgentGateCorrectedError,
  AgentGateKind,
  AgentGateReply,
  applyWorkspaceSecurityModeToConfig,
  cloneBaishouAgentGateConfig,
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG
} from '@baishou/shared'
import { createBaishouAgentGate } from '../baishou-agent-gate.service'
import { baseAssertInput } from './baishou-agent-gate.test-helpers'

describe('BaishouAgentGateService', () => {
  it('proactive companion_ask 在 full_access 与自动接受下仍等待选择', async () => {
    const config = applyWorkspaceSecurityModeToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      'full_access'
    )
    const { gate } = createBaishouAgentGate({
      config,
      isAutoAccept: () => true
    })

    const pending = gate.assertWithResolution({
      ...baseAssertInput,
      kind: AgentGateKind.Proactive,
      action: 'companion_ask',
      title: '选哪个？',
      options: [
        { id: '0', label: 'A' },
        { id: '1', label: 'B' }
      ]
    })

    await Promise.resolve()
    const [request] = gate.listPending('sess_1')
    expect(request?.action).toBe('companion_ask')
    expect(request?.kind).toBe(AgentGateKind.Proactive)

    await gate.reply({
      requestId: request!.id,
      reply: AgentGateReply.Once,
      selectedOptionIds: ['1']
    })

    const resolution = await pending
    expect(resolution.selectedOptionIds).toEqual(['1'])
  })

  it('always 不级联放行同 action 的截断预览 pending', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const normal = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写完整',
      resources: [{ kind: 'workspace_path', value: 'src/a.ts' }],
      preview: {
        type: 'file_change',
        path: 'src/a.ts',
        kind: 'modify',
        additions: 1,
        deletions: 0,
        contentDigest: 'full'
      }
    })
    await Promise.resolve()
    const normalReq = gate.listPending('sess_1')[0]
    expect(normalReq).toBeTruthy()
    await gate.reply({ requestId: normalReq!.id, reply: AgentGateReply.Always })
    await normal

    const truncated = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写截断',
      resources: [{ kind: 'workspace_path', value: 'src/b.ts' }],
      preview: {
        type: 'file_change',
        path: 'src/b.ts',
        kind: 'modify',
        additions: 1,
        deletions: 0,
        truncated: true,
        contentDigest: 'cut'
      }
    })
    await Promise.resolve()
    const stillPending = gate.listPending('sess_1')
    expect(stillPending).toHaveLength(1)
    expect(stillPending[0]?.title).toBe('写截断')

    await gate.reply({ requestId: stillPending[0]!.id, reply: AgentGateReply.Once })
    await truncated
  })

  it('always 不级联放行同 action 的外路径 pending', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const internal = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写内部',
      resources: [{ kind: 'workspace_path', value: 'src/a.ts' }]
    })
    const external = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写外部',
      resources: [{ kind: 'external_path', value: 'C:/Outside/x.txt' }]
    })

    const pending = gate.listPending('sess_1')
    expect(pending).toHaveLength(2)
    const internalReq = pending.find((r) => r.title === '写内部')
    expect(internalReq).toBeTruthy()
    await gate.reply({ requestId: internalReq!.id, reply: AgentGateReply.Always })
    await internal

    const stillPending = gate.listPending('sess_1')
    expect(stillPending).toHaveLength(1)
    expect(stillPending[0]?.title).toBe('写外部')

    await gate.reply({ requestId: stillPending[0]!.id, reply: AgentGateReply.Once })
    await external
  })

  it('always persist 失败时 assert 仍能 settle', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('disk full'))
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      },
      persistConfig: persist
    })

    const pendingAssert = gate.assert(baseAssertInput)
    const [request] = gate.listPending('sess_1')
    await expect(
      gate.reply({ requestId: request!.id, reply: AgentGateReply.Always })
    ).resolves.toBeUndefined()
    await expect(pendingAssert).resolves.toBeUndefined()
    await Promise.resolve()
    expect(persist).toHaveBeenCalled()
  })

  it('reject 级联时同 session 其它请求也带 CorrectedError', async () => {
    const { gate } = createBaishouAgentGate()

    const first = gate.assert(baseAssertInput).catch((e) => e)
    const second = gate
      .assert({ ...baseAssertInput, action: 'diary_write', title: '写日记' })
      .catch((e) => e)

    const pending = gate.listPending('sess_1')
    await gate.reply({
      requestId: pending[0]!.id,
      reply: AgentGateReply.Reject,
      message: '先别改'
    })

    const firstError = await first
    const secondError = await second
    expect(firstError).toBeInstanceOf(AgentGateCorrectedError)
    expect(secondError).toBeInstanceOf(AgentGateCorrectedError)
    expect((secondError as AgentGateCorrectedError).feedback).toBe('先别改')
  })
})
