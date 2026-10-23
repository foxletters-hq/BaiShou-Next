import { describe, it, expect, vi } from 'vitest'
import { AgentGateKind, AgentGateRequestStatus } from '@baishou/shared'
import { BaishouAgentGateEventBus } from '../baishou-agent-gate-event-bus'
import { bridgeAgentGateEventBus } from '../agent-gate-lifecycle-bridge'
import { onAgentGateLifecycle } from '../../agent/agent-gate-lifecycle'

describe('bridgeAgentGateEventBus', () => {
  it('forwards eventBus events to onAgentGateLifecycle subscribers', () => {
    const eventBus = new BaishouAgentGateEventBus()
    const listener = vi.fn()
    const unsubLifecycle = onAgentGateLifecycle(listener)
    const unsubBridge = bridgeAgentGateEventBus(eventBus)

    eventBus.publish({
      type: 'agent_gate.asked',
      request: {
        id: 'bag_bridge_1',
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

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'agent_gate.asked',
        request: expect.objectContaining({ id: 'bag_bridge_1' })
      })
    )

    unsubBridge()
    unsubLifecycle()
  })
})
