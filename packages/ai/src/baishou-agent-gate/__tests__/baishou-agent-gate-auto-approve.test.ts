import { describe, expect, it, vi } from 'vitest'
import {
  AgentGateDeniedError,
  AgentGateEffect,
  AgentGateKind,
  AgentGateReply
} from '@baishou/shared'
import type { IBaishouAgentGate } from '../baishou-agent-gate.types'
import { createAutoApproveAgentGate } from '../baishou-agent-gate-auto-approve'
import { baseAssertInput } from './baishou-agent-gate.test-helpers'

function createGate(effect: AgentGateEffect) {
  const assert = vi.fn(async () => {
    if (effect === AgentGateEffect.Deny) throw new AgentGateDeniedError('memory_delete')
  })
  const assertWithResolution = vi.fn(async () => {
    if (effect === AgentGateEffect.Deny) throw new AgentGateDeniedError('memory_delete')
    return { requestId: 'bag_1', reply: AgentGateReply.Once, resolvedAt: 1 }
  })
  const probeEffect = vi.fn(() => effect)
  const gate: IBaishouAgentGate = {
    assert,
    assertWithResolution,
    ask: vi.fn(),
    reply: vi.fn(),
    get: vi.fn(),
    listPending: vi.fn(() => []),
    cancelSession: vi.fn(),
    probeEffect
  }
  return { gate, assert, assertWithResolution, probeEffect }
}

describe('createAutoApproveAgentGate', () => {
  it('passes Ask tools without creating a confirmation request', async () => {
    const { gate, assert } = createGate(AgentGateEffect.Ask)
    const auto = createAutoApproveAgentGate(gate)

    await expect(auto.assert(baseAssertInput)).resolves.toBeUndefined()
    expect(assert).not.toHaveBeenCalled()
  })

  it('still rejects Deny tools', async () => {
    const { gate, assert } = createGate(AgentGateEffect.Deny)
    const auto = createAutoApproveAgentGate(gate)

    await expect(auto.assert(baseAssertInput)).rejects.toBeInstanceOf(AgentGateDeniedError)
    expect(assert).toHaveBeenCalledTimes(1)
  })

  it('does not auto-answer proactive questions', async () => {
    const { gate, assert } = createGate(AgentGateEffect.Ask)
    const auto = createAutoApproveAgentGate(gate)

    await auto.assert({ ...baseAssertInput, kind: AgentGateKind.Proactive })

    expect(assert).toHaveBeenCalledTimes(1)
  })

  it('returns a synthetic once resolution for allowed tools', async () => {
    const { gate, assertWithResolution } = createGate(AgentGateEffect.Ask)
    const auto = createAutoApproveAgentGate(gate)

    await expect(auto.assertWithResolution(baseAssertInput)).resolves.toEqual({
      requestId: '',
      reply: AgentGateReply.Once,
      resolvedAt: expect.any(Number)
    })
    expect(assertWithResolution).not.toHaveBeenCalled()
  })

  it('merges metadata resources before probing deny rules', async () => {
    const { gate, probeEffect } = createGate(AgentGateEffect.Ask)
    const auto = createAutoApproveAgentGate(gate)

    await auto.assert({
      ...baseAssertInput,
      metadata: { externalPath: '/tmp/outside' }
    })

    expect(probeEffect).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: expect.arrayContaining([{ kind: 'external_path', value: '/tmp/outside' }])
      })
    )
  })
})
