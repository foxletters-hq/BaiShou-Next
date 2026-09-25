import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  AgentGateCancelledError,
  AgentGateCorrectedError,
  AgentGateKind,
  AgentGateRejectedError,
  AgentGateReply
} from '@baishou/shared'
import { deriveLegacyVaultId } from '@baishou/shared'
import { CompanionAskTool } from '../companion-ask.tool'
import type { ToolContext } from '../agent.tool'
import type { IBaishouAgentGate } from '../../baishou-agent-gate/baishou-agent-gate.service'
import { createBaishouAgentGate } from '../../baishou-agent-gate/baishou-agent-gate.service'
import {
  clearCompanionAskStreamSessionsForTests,
  startCompanionAskFromStreamInput
} from '../companion-ask-stream.util'

const baseContext: ToolContext = {
  sessionId: 'sess_1',
  vaultId: deriveLegacyVaultId('Personal'),
  vaultName: 'Personal'
}

afterEach(() => {
  clearCompanionAskStreamSessionsForTests()
})

describe('CompanionAskTool', () => {
  const tool = new CompanionAskTool()

  it('returns approved JSON when gate is absent', async () => {
    const result = await tool.execute({ question: '继续吗？' }, baseContext)
    expect(JSON.parse(result)).toEqual({
      approved: true,
      question: '继续吗？',
      answers: [{ question: '继续吗？', answer: null, selectedOptionIds: [] }]
    })
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
        allowCustomInput: false,
        options: [
          { id: '0', label: 'A' },
          { id: '1', label: 'B' }
        ],
        questions: [
          {
            id: '0',
            question: '选哪个？',
            options: [
              { id: '0', label: 'A' },
              { id: '1', label: 'B' }
            ],
            allowCustomInput: false
          }
        ]
      })
    )
    expect(JSON.parse(result)).toEqual({
      approved: true,
      question: '选哪个？',
      answer: 'A',
      selectedOptionIds: ['0'],
      answers: [{ question: '选哪个？', answer: 'A', selectedOptionIds: ['0'] }]
    })
  })

  it('returns user feedback on corrected rejection', async () => {
    const gate = {
      assertWithResolution: vi.fn().mockRejectedValue(new AgentGateCorrectedError('自定义答案'))
    } as unknown as IBaishouAgentGate

    const result = await tool.execute({ question: '选哪个？' }, { ...baseContext, agentGate: gate })
    expect(result).toBe('自定义答案')
  })

  it('returns declined JSON when the gate is cancelled', async () => {
    const gate = {
      assertWithResolution: vi.fn().mockRejectedValue(new AgentGateCancelledError('stream aborted'))
    } as unknown as IBaishouAgentGate

    const result = await tool.execute({ question: '选哪个？' }, { ...baseContext, agentGate: gate })
    expect(JSON.parse(result)).toEqual({
      approved: false,
      declined: true,
      question: '选哪个？',
      answers: [{ question: '选哪个？', answer: null, selectedOptionIds: [] }]
    })
  })

  it('returns the cancelled notice when the user declines', async () => {
    const gate = {
      assertWithResolution: vi.fn().mockRejectedValue(new AgentGateRejectedError())
    } as unknown as IBaishouAgentGate

    const result = await tool.execute({ question: '选哪个？' }, { ...baseContext, agentGate: gate })
    expect(result).toBe('用户取消了这一次操作')
  })

  it('returns the cancelled notice in the current locale', async () => {
    const gate = {
      assertWithResolution: vi.fn().mockRejectedValue(new AgentGateRejectedError())
    } as unknown as IBaishouAgentGate

    const result = await tool.execute(
      { question: '选哪个？' },
      { ...baseContext, agentGate: gate, userConfig: { locale: 'en' } }
    )
    expect(result).toBe('The user cancelled this operation.')
  })

  it('does not convert a rejection into a tool failure string', async () => {
    const vercelTool = tool.toVercelTool({
      ...baseContext,
      agentGate: {
        assertWithResolution: vi.fn().mockRejectedValue(new AgentGateRejectedError())
      } as unknown as IBaishouAgentGate
    })

    await expect(vercelTool.execute({ question: '选哪个？' })).resolves.toBe('用户取消了这一次操作')
  })

  it('does not use tool interceptor metadata', () => {
    expect(tool.agentGateMetadata).toBeUndefined()
  })

  it('should open the gate when argument deltas complete before the stream finishes', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })
    const vercelTool = tool.toVercelTool({ ...baseContext, agentGate: gate })

    vercelTool.onInputDelta({
      toolCallId: 'call_1',
      inputTextDelta: '{"question":"你在哪个城市？","options":["北京","上海"]}'
    })

    const [request] = gate.listPending('sess_1')
    expect(request?.action).toBe('companion_ask')
    expect(request?.title).toBe('你在哪个城市？')
    expect(gate.listPending('sess_1')).toHaveLength(1)

    const pending = vercelTool.execute(
      { question: '你在哪个城市？', options: ['北京', '上海'] },
      { toolCallId: 'call_1' }
    )
    expect(gate.listPending('sess_1')).toHaveLength(1)

    await gate.reply({
      requestId: request!.id,
      reply: AgentGateReply.Once,
      selectedOptionIds: ['0']
    })

    expect(JSON.parse(await pending)).toEqual({
      approved: true,
      question: '你在哪个城市？',
      answer: '北京',
      selectedOptionIds: ['0'],
      answers: [{ question: '你在哪个城市？', answer: '北京', selectedOptionIds: ['0'] }]
    })
  })

  it('should open the gate when complete input is available before execute', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })
    const vercelTool = tool.toVercelTool({ ...baseContext, agentGate: gate })

    vercelTool.onInputAvailable({
      toolCallId: 'call_1',
      input: { question: '你在哪个城市？', options: ['北京', '上海'] }
    })

    const [request] = gate.listPending('sess_1')
    expect(request?.title).toBe('你在哪个城市？')
    expect(gate.listPending('sess_1')).toHaveLength(1)

    const pending = vercelTool.execute(
      { question: '你在哪个城市？', options: ['北京', '上海'] },
      { toolCallId: 'call_1' }
    )
    expect(gate.listPending('sess_1')).toHaveLength(1)

    await gate.reply({
      requestId: request!.id,
      reply: AgentGateReply.Once,
      selectedOptionIds: ['0']
    })
    await pending
  })

  it('should open the gate from a streamed TOOL_CALL without going through execute', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })
    tool.toVercelTool({ ...baseContext, agentGate: gate })

    startCompanionAskFromStreamInput(
      { companion_ask: {} },
      {
        toolName: 'companion_ask',
        toolCallId: 'call_1',
        input: { question: '你在哪个城市？', options: ['北京', '上海'] }
      },
      'sess_1'
    )

    await Promise.resolve()
    const [request] = gate.listPending('sess_1')
    expect(request?.title).toBe('你在哪个城市？')
  })

  it('resolves selected option through real gate service', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
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
      selectedOptionIds: ['1'],
      answers: [{ question: '选哪个？', answer: 'B', selectedOptionIds: ['1'] }]
    })
  })

  it('returns custom message answer from gate resolution', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
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
      selectedOptionIds: [],
      answers: [{ question: '你的偏好？', answer: '我喜欢简洁风格', selectedOptionIds: [] }]
    })
  })

  it('asks independent questions together on one card', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const pending = tool.execute(
      {
        questions: [
          { question: '放在哪个文件夹？', options: ['当前根目录下新建', '先不创建'] },
          { question: '文件夹叫什么？', options: ['写作-3'], allow_custom_input: true }
        ]
      },
      { ...baseContext, agentGate: gate }
    )

    const [request] = gate.listPending('sess_1')
    expect(request?.questions).toHaveLength(2)
    expect(gate.listPending('sess_1')).toHaveLength(1)

    await gate.reply({
      requestId: request!.id,
      reply: AgentGateReply.Once,
      questionAnswers: [
        { questionId: '0', selectedOptionIds: ['0'] },
        { questionId: '1', selectedOptionIds: ['0'] }
      ]
    })

    const result = await pending
    expect(JSON.parse(result)).toEqual({
      approved: true,
      question: '放在哪个文件夹？',
      answer: '当前根目录下新建',
      selectedOptionIds: ['0'],
      answers: [
        { question: '放在哪个文件夹？', answer: '当前根目录下新建', selectedOptionIds: ['0'] },
        { question: '文件夹叫什么？', answer: '写作-3', selectedOptionIds: ['0'] }
      ]
    })
  })
})
