import { describe, it, expect, vi } from 'vitest'
import { AgentGateReply, type AgentGateResolution } from '@baishou/shared'
import {
  dispatchLifecycleResolved,
  registerLifecycleHandler,
  unregisterLifecycleHandler
} from '../baishou-agent-gate-handler.registry'

describe('baishou-agent-gate-handler.registry', () => {
  it('dispatches registered lifecycle handlers', async () => {
    const handler = vi.fn()
    registerLifecycleHandler('lifecycle_test', handler)

    const resolution: AgentGateResolution = {
      requestId: 'bag_1',
      reply: AgentGateReply.Once,
      resolvedAt: Date.now()
    }

    await dispatchLifecycleResolved('lifecycle_test', resolution, { sessionId: 'sess_1' })
    expect(handler).toHaveBeenCalledWith(resolution, { sessionId: 'sess_1' })

    unregisterLifecycleHandler('lifecycle_test')
    handler.mockClear()
    await dispatchLifecycleResolved('lifecycle_test', resolution, {})
    expect(handler).not.toHaveBeenCalled()
  })
})
