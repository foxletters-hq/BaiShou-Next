import { describe, expect, it } from 'vitest'
import { AgentGateKind, AgentGateRequestStatus } from '@baishou/shared'
import type { AgentGateRequest } from '@baishou/shared'
import {
  matchCompanionAskPendingRequest,
  presentationFromCompanionAskRequest
} from '../companion-ask-interaction.util'

function request(partial: Partial<AgentGateRequest> = {}): AgentGateRequest {
  return {
    id: 'bag_1',
    sessionId: 'sess_1',
    vaultName: 'Personal',
    status: AgentGateRequestStatus.Pending,
    kind: AgentGateKind.Proactive,
    action: 'companion_ask',
    title: '你想让我研究什么想法？',
    options: [
      { id: '0', label: 'A' },
      { id: '1', label: 'B' }
    ],
    allowCustomInput: true,
    metadata: {},
    createdAt: 1,
    ...partial
  }
}

describe('matchCompanionAskPendingRequest', () => {
  it('matches an unanswered companion_ask card to the pending request', () => {
    const pending = request()
    expect(
      matchCompanionAskPendingRequest(
        pending,
        {
          mode: 'companion_ask',
          question: pending.title,
          answer: null,
          declined: false,
          options: pending.options,
          selectedOptionIds: []
        },
        'companion_ask'
      )?.id
    ).toBe('bag_1')
  })

  it('does not match after the user already answered', () => {
    expect(
      matchCompanionAskPendingRequest(
        request(),
        {
          mode: 'companion_ask',
          question: '你想让我研究什么想法？',
          answer: 'A',
          declined: false,
          options: [
            { id: '0', label: 'A' },
            { id: '1', label: 'B' }
          ],
          selectedOptionIds: ['0']
        },
        'companion_ask'
      )
    ).toBeNull()
  })
})

describe('presentationFromCompanionAskRequest', () => {
  it('copies the pending question and options', () => {
    const presentation = presentationFromCompanionAskRequest(request())
    expect(presentation.question).toBe('你想让我研究什么想法？')
    expect(presentation.options.map((option) => option.label)).toEqual(['A', 'B'])
    expect(presentation.selectedOptionIds).toEqual([])
  })
})
