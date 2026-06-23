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
})
