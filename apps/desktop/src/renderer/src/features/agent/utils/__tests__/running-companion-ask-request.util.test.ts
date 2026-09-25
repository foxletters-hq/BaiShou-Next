import { AgentGateKind, AgentGateRequestStatus, type AgentGateRequest } from '@baishou/shared'
import { describe, expect, it } from 'vitest'
import {
  buildRunningCompanionAskRequest,
  findSessionCompanionAskRequest,
  isLocalCompanionAskRequestId,
  resolveCompanionAskDockRequest,
  waitForLiveCompanionAskRequest
} from '../running-companion-ask-request.util'

describe('buildRunningCompanionAskRequest', () => {
  it('should build a card from a running companion_ask that already has a question', () => {
    const request = buildRunningCompanionAskRequest('sess_1', [
      {
        kind: 'tool',
        callId: 'call_1',
        name: 'companion_ask',
        status: 'running',
        arguments: {
          question: '你在哪座城市？',
          options: ['我直接告诉你城市名', '先算了，不查了'],
          allow_custom_input: true
        }
      }
    ])

    expect(request?.title).toBe('你在哪座城市？')
    expect(request?.options.map((option) => option.label)).toEqual([
      '我直接告诉你城市名',
      '先算了，不查了'
    ])
    expect(request?.allowCustomInput).toBe(true)
    expect(isLocalCompanionAskRequestId(request?.id ?? '')).toBe(true)
  })

  it('should rebuild a card after arguments are filled on the same timeline array', () => {
    const timeline: Parameters<typeof buildRunningCompanionAskRequest>[1] = [
      { kind: 'tool', callId: 'call_1', name: 'companion_ask', status: 'running', arguments: {} }
    ]
    expect(buildRunningCompanionAskRequest('sess_1', timeline)).toBeNull()
    const running = timeline[0]
    if (running?.kind === 'tool') {
      running.arguments = { question: '你在哪座城市？' }
    }
    expect(buildRunningCompanionAskRequest('sess_1', timeline)?.title).toBe('你在哪座城市？')
  })
})

describe('findSessionCompanionAskRequest', () => {
  it('should find the live gate request for this session', () => {
    const live = {
      id: 'bag_1',
      sessionId: 'sess_1',
      vaultName: 'Personal',
      status: AgentGateRequestStatus.Pending,
      kind: AgentGateKind.Proactive,
      action: 'companion_ask',
      title: '你在哪座城市？',
      options: [],
      allowCustomInput: true,
      metadata: {},
      createdAt: 1
    } satisfies AgentGateRequest

    expect(findSessionCompanionAskRequest([live], 'sess_1')?.id).toBe('bag_1')
    expect(findSessionCompanionAskRequest([live], 'other')).toBeUndefined()
  })
})

describe('resolveCompanionAskDockRequest', () => {
  it('should keep a local preview card only while the stream is still running', () => {
    const timeline = [
      {
        kind: 'tool' as const,
        callId: 'call_1',
        name: 'companion_ask',
        status: 'running' as const,
        arguments: { question: '你在哪座城市？' }
      }
    ]
    expect(
      resolveCompanionAskDockRequest({
        pendingGate: null,
        sessionId: 'sess_1',
        timeline,
        isStreaming: true
      })?.title
    ).toBe('你在哪座城市？')
    expect(
      resolveCompanionAskDockRequest({
        pendingGate: null,
        sessionId: 'sess_1',
        timeline,
        isStreaming: false
      })
    ).toBeNull()
  })
})

describe('waitForLiveCompanionAskRequest', () => {
  it('should resolve the live inbox card after a short wait', async () => {
    const live = {
      id: 'bag_1',
      sessionId: 'sess_1',
      vaultName: 'Personal',
      status: AgentGateRequestStatus.Pending,
      kind: AgentGateKind.Proactive,
      action: 'companion_ask',
      title: '你在哪座城市？',
      options: [],
      allowCustomInput: true,
      metadata: {},
      createdAt: 1
    } satisfies AgentGateRequest
    let pending: AgentGateRequest[] = []

    const found = await waitForLiveCompanionAskRequest({
      sessionId: 'sess_1',
      attempts: 3,
      delayMs: 1,
      readInbox: () => pending,
      listPending: async () => {
        pending = [live]
        return pending
      }
    })

    expect(found?.id).toBe('bag_1')
  })
})
