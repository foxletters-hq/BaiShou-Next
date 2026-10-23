import { describe, it, expect } from 'vitest'
import { AgentGateReply, AgentGateKind, AgentGateRequestStatus } from '@baishou/shared'
import {
  BaishouAgentGateSessionBuffer,
  subscribeAgentGateSessionBuffer
} from '../baishou-agent-gate-session-buffer'
import { BaishouAgentGateEventBus } from '../baishou-agent-gate-event-bus'

describe('BaishouAgentGateSessionBuffer', () => {
  it('collects asked and replied events into part data', () => {
    const buffer = new BaishouAgentGateSessionBuffer()
    const eventBus = new BaishouAgentGateEventBus()
    const unsubscribe = subscribeAgentGateSessionBuffer(eventBus, buffer)

    eventBus.publish({
      type: 'agent_gate.asked',
      request: {
        id: 'bag_1',
        sessionId: 'sess_1',
        vaultName: 'Personal',
        status: AgentGateRequestStatus.Pending,
        kind: AgentGateKind.Tool,
        action: 'diary_edit',
        title: '编辑日记',
        options: [],
        allowCustomInput: false,
        metadata: {},
        createdAt: 1
      }
    })

    eventBus.publish({
      type: 'agent_gate.replied',
      sessionId: 'sess_1',
      requestId: 'bag_1',
      reply: AgentGateReply.Once
    })

    const parts = buffer.buildPartDataList()
    expect(parts).toHaveLength(1)
    expect(parts[0]?.request.id).toBe('bag_1')
    expect(parts[0]?.resolution?.reply).toBe(AgentGateReply.Once)
    unsubscribe()
  })

  it('keeps a single part when the same request is asked again with a higher count', () => {
    const buffer = new BaishouAgentGateSessionBuffer()
    buffer.handleEvent({
      type: 'agent_gate.asked',
      request: {
        id: 'bag_1',
        sessionId: 'sess_1',
        vaultName: 'Personal',
        status: AgentGateRequestStatus.Pending,
        kind: AgentGateKind.Tool,
        action: 'recall_relations',
        title: '回忆关系图谱',
        options: [],
        allowCustomInput: false,
        metadata: {},
        coalescedCount: 1,
        createdAt: 1
      }
    })
    buffer.handleEvent({
      type: 'agent_gate.asked',
      request: {
        id: 'bag_1',
        sessionId: 'sess_1',
        vaultName: 'Personal',
        status: AgentGateRequestStatus.Pending,
        kind: AgentGateKind.Tool,
        action: 'recall_relations',
        title: '回忆关系图谱',
        options: [],
        allowCustomInput: false,
        metadata: {},
        coalescedCount: 3,
        createdAt: 1
      }
    })
    const parts = buffer.buildPartDataList()
    expect(parts).toHaveLength(1)
    expect(parts[0]?.request.coalescedCount).toBe(3)
  })

  it('should keep questionAnswers on the replied part', () => {
    const buffer = new BaishouAgentGateSessionBuffer()
    buffer.handleEvent({
      type: 'agent_gate.asked',
      request: {
        id: 'bag_ask',
        sessionId: 'sess_1',
        vaultName: 'Personal',
        status: AgentGateRequestStatus.Pending,
        kind: AgentGateKind.Proactive,
        action: 'companion_ask',
        title: '放在哪？',
        options: [],
        allowCustomInput: true,
        metadata: {},
        createdAt: 1
      }
    })
    buffer.handleEvent({
      type: 'agent_gate.replied',
      sessionId: 'sess_1',
      requestId: 'bag_ask',
      reply: AgentGateReply.Once,
      questionAnswers: [{ questionId: '0', selectedOptionIds: ['0'] }]
    })
    expect(buffer.buildPartDataList()[0]?.resolution?.questionAnswers).toEqual([
      { questionId: '0', selectedOptionIds: ['0'] }
    ])
  })
})
