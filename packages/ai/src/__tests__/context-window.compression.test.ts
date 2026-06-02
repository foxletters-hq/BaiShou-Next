import { describe, it, expect, vi } from 'vitest'
import { ContextWindowBuilder } from '../agent/context-window.builder'
import type { MessageWithParts } from '../agent/message.adapter'

function makeMsg(id: string, role: string, orderIndex: number): MessageWithParts {
  return {
    id,
    sessionId: 's1',
    role: role as MessageWithParts['role'],
    isSummary: false,
    orderIndex,
    createdAt: new Date(),
    parts: [
      {
        id: `p-${id}`,
        messageId: id,
        sessionId: 's1',
        type: 'text',
        data: { text: `${role}-${orderIndex}` }
      }
    ]
  }
}

describe('ContextWindowBuilder with tailStartMessageId', () => {
  it('retains from tail_start_message_id instead of coveredUpTo+1', async () => {
    const messages = [
      makeMsg('1', 'user', 1),
      makeMsg('2', 'assistant', 2),
      makeMsg('3', 'user', 3),
      makeMsg('4', 'assistant', 4),
      makeMsg('5', 'user', 5)
    ]

    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue(messages)
    }
    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValue({
        id: 9,
        sessionId: 's1',
        summaryText: '摘要',
        coveredUpToMessageId: '2',
        tailStartMessageId: '3',
        messageCount: 2,
        tokenCount: null,
        createdAt: new Date()
      })
    }

    const result = await ContextWindowBuilder.build(
      's1',
      sessionRepo as any,
      snapshotRepo as any,
      { recentCount: 0 }
    )

    expect(result[0]?.isSummary).toBe(true)
    expect(result.map((m) => m.id)).toEqual(['snapshot_9', '3', '4', '5'])
  })
})
