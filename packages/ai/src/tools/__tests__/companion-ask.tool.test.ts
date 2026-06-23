import { describe, it, expect, vi } from 'vitest'
import {
  AgentGateCorrectedError,
  AgentGateKind,
  AgentGateRejectedError,
  AgentGateReply,
  AgentGateTrustMode
} from '@baishou/shared'
import { CompanionAskTool } from '../companion-ask.tool'
import type { ToolContext } from '../agent.tool'
import type { IBaishouAgentGate } from '../../baishou-agent-gate/baishou-agent-gate.service'
import { createBaishouAgentGate } from '../../baishou-agent-gate/baishou-agent-gate.service'

const baseContext: ToolContext = {
  sessionId: 'sess_1',
  vaultName: 'Personal'
}

describe('CompanionAskTool', () => {
  const tool = new CompanionAskTool()

  it('returns approved JSON when gate is absent', async () => {
    const result = await tool.execute({ question: '继续吗？' }, baseContext)
    expect(JSON.parse(result)).toEqual({ approved: true, question: '继续吗？' })
  })

  it('calls proactive gate assertWithResolution with options', async () => {
    const assertWithResolution = vi.fn().mockResolvedValue({
      requestId: 'bag_1',
      reply: 'once',
      selectedOptionIds: ['0'],
      resolvedAt: Date.now()
    })
    const gate = { assertWithResolution } as unknown as IBaishouAgentGate

    const result = await tool.execute(
      {
        question: '选哪个？',
        options: ['A', 'B'],
        allow_custom_input: false
      },
      { ...baseContext, agentGate: gate }
    )

    expect(assertWithResolution).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess_1',
        vaultName: 'Personal',
        kind: AgentGateKind.Proactive,
        action: 'companion_ask',
        title: '选哪个？',
        description: '1. A\n2. B',
        allowCustomInput: false,
        options: [
          { id: '0', label: 'A' },
          { id: '1', label: 'B' }
        ]
      })
    )
    expect(JSON.parse(result)).toEqual({
      approved: true,
      question: '选哪个？',
      answer: 'A',
      selectedOptionIds: ['0']
    })
  })

  it('returns user feedback on corrected rejection', async () => {
    const gate = {
      assertWithResolution: vi.fn().mockRejectedValue(new AgentGateCorrectedError('自定义答案'))
    } as unknown as IBaishouAgentGate

    const result = await tool.execute({ question: '选哪个？' }, { ...baseContext, agentGate: gate })
    expect(result).toBe('自定义答案')
  })

  it('returns declined message on rejection', async () => {
    const gate = {
      assertWithResolution: vi.fn().mockRejectedValue(new AgentGateRejectedError())
    } as unknown as IBaishouAgentGate

    const result = await tool.execute({ question: '选哪个？' }, { ...baseContext, agentGate: gate })
    expect(result).toBe('User declined to answer.')
  })

  it('does not use tool interceptor metadata', () => {
    expect(tool.agentGateMetadata).toBeUndefined()
  })

  it('resolves selected option through real gate service', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        trustMode: AgentGateTrustMode.Manual,
        exclusionList: [],
        allowlist: []
      }
    })

    const pending = tool.execute(
      { question: '选哪个？', options: ['A', 'B'], allow_custom_input: false },
      { ...baseContext, agentGate: gate }
    )

    const [request] = gate.listPending('sess_1')
    expect(request?.kind).toBe(AgentGateKind.Proactive)
    expect(request?.action).toBe('companion_ask')

    await gate.reply({
      requestId: request!.id,
      reply: AgentGateReply.Once,
      selectedOptionIds: ['1']
    })

    const result = await pending
    expect(JSON.parse(result)).toEqual({
      approved: true,
      question: '选哪个？',
      answer: 'B',
      selectedOptionIds: ['1']
    })
  })

  it('returns custom message answer from gate resolution', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        trustMode: AgentGateTrustMode.Manual,
        exclusionList: [],
        allowlist: []
      }
    })

    const pending = tool.execute(
      { question: '你的偏好？', allow_custom_input: true },
      { ...baseContext, agentGate: gate }
    )

    const [request] = gate.listPending('sess_1')
    await gate.reply({
      requestId: request!.id,
      reply: AgentGateReply.Once,
      message: '我喜欢简洁风格'
    })

    const result = await pending
    expect(JSON.parse(result)).toEqual({
      approved: true,
      question: '你的偏好？',
      answer: '我喜欢简洁风格',
      selectedOptionIds: []
    })
  })
})
