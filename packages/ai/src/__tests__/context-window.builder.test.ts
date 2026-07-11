import { describe, it, expect, vi } from 'vitest'
import { ContextWindowBuilder } from '../agent/context-window.builder'
import type { MessageWithParts } from '../agent/message.adapter'

function makeMsg(role: string, orderIndex: number): MessageWithParts {
  return {
    id: `m${orderIndex}`,
    sessionId: 'session_1',
    role,
    isSummary: false,
    orderIndex,
    createdAt: new Date(),
    parts: []
  } as MessageWithParts
}

describe('ContextWindowBuilder', () => {
  it('truncates by conversation turns (user message + reply + tools in same turn)', async () => {
    const messages: MessageWithParts[] = [
      makeMsg('user', 0),
      makeMsg('assistant', 1),
      makeMsg('tool', 2),
      makeMsg('user', 3),
      makeMsg('assistant', 4)
    ]

    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue(messages)
    }
    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValue(null)
    }

    const result = await ContextWindowBuilder.build(
      'session_1',
      sessionRepo as any,
      snapshotRepo as any,
      { recentCount: 1 }
    )

    expect(result.map((m) => m.orderIndex)).toEqual([3, 4])
  })

  it('keeps tool messages attached to their turn when truncating', async () => {
    const messages: MessageWithParts[] = [
      makeMsg('user', 0),
      makeMsg('assistant', 1),
      makeMsg('tool', 2),
      makeMsg('user', 3),
      makeMsg('assistant', 4)
    ]

    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue(messages)
    }
    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValue(null)
    }

    const result = await ContextWindowBuilder.build(
      'session_1',
      sessionRepo as any,
      snapshotRepo as any,
      { recentCount: 2 }
    )

    expect(result.map((m) => m.orderIndex)).toEqual([0, 1, 2, 3, 4])
  })

  it('does not truncate when recentCount is 0 (unlimited)', async () => {
    const messages: MessageWithParts[] = [
      makeMsg('user', 0),
      makeMsg('assistant', 1),
      makeMsg('user', 2),
      makeMsg('assistant', 3)
    ]

    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue(messages)
    }
    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValue(null)
    }

    const result = await ContextWindowBuilder.build(
      'session_1',
      sessionRepo as any,
      snapshotRepo as any,
      { recentCount: 0 }
    )

    expect(result).toHaveLength(4)
  })

  it('keeps requiredMessageId when recentCount would drop an earlier pending user turn', async () => {
    const messages: MessageWithParts[] = [
      makeMsg('user', 0),
      makeMsg('assistant', 1),
      makeMsg('user', 2),
      makeMsg('assistant', 3),
      makeMsg('user', 4)
    ]
    messages[2]!.id = 'user-msg-1'
    messages[4]!.id = 'user-msg-2'

    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue(messages)
    }
    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValue(null)
    }

    const withoutAnchor = await ContextWindowBuilder.build(
      'session_1',
      sessionRepo as any,
      snapshotRepo as any,
      { recentCount: 1 }
    )
    expect(withoutAnchor.map((m) => m.id)).toEqual(['user-msg-2'])

    const withAnchor = await ContextWindowBuilder.build(
      'session_1',
      sessionRepo as any,
      snapshotRepo as any,
      { recentCount: 1, requiredMessageId: 'user-msg-1' }
    )
    expect(withAnchor.map((m) => m.id)).toEqual(['user-msg-1', 'm3', 'user-msg-2'])
  })

  it('applies snapshot retain slice when tailStartMessageId is missing but coveredUpTo resolves', async () => {
    const messages: MessageWithParts[] = [
      { ...makeMsg('user', 1), id: '1' },
      { ...makeMsg('assistant', 2), id: '2' },
      { ...makeMsg('user', 3), id: '3' },
      { ...makeMsg('assistant', 4), id: '4' },
      { ...makeMsg('user', 5), id: '5' }
    ]

    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue(messages)
    }
    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValue({
        id: 9,
        sessionId: 'session_1',
        summaryText: '摘要',
        coveredUpToMessageId: '2',
        tailStartMessageId: 'missing-tail-id',
        messageCount: 2,
        tokenCount: null,
        createdAt: new Date()
      })
    }

    const result = await ContextWindowBuilder.build(
      'session_1',
      sessionRepo as any,
      snapshotRepo as any,
      { recentCount: 0 }
    )

    expect(result[0]?.isSummary).toBe(true)
    expect(result.map((m) => m.id)).toEqual(['snapshot_9', '3', '4', '5'])
  })

  it('does not fall back to full history when snapshot exists but retain anchor is at index 0', async () => {
    const messages: MessageWithParts[] = [
      { ...makeMsg('user', 1), id: '1' },
      { ...makeMsg('assistant', 2), id: '2' },
      { ...makeMsg('user', 3), id: '3' }
    ]

    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue(messages)
    }
    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValue({
        id: 10,
        sessionId: 'session_1',
        summaryText: '摘要',
        coveredUpToMessageId: 'gone',
        tailStartMessageId: '1',
        messageCount: 0,
        tokenCount: null,
        createdAt: new Date()
      })
    }

    const result = await ContextWindowBuilder.build(
      'session_1',
      sessionRepo as any,
      snapshotRepo as any,
      { recentCount: 0 }
    )

    expect(result[0]?.isSummary).toBe(true)
    expect(result.map((m) => m.id)).toEqual(['snapshot_10', '1', '2', '3'])
  })

  it('does not fall back to full history when snapshot anchors are lost and summary is empty', async () => {
    const messages: MessageWithParts[] = [
      { ...makeMsg('user', 1), id: '1' },
      { ...makeMsg('assistant', 2), id: '2' },
      { ...makeMsg('user', 3), id: '3' },
      { ...makeMsg('assistant', 4), id: '4' }
    ]

    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue(messages)
    }
    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValue({
        id: 11,
        sessionId: 'session_1',
        summaryText: '   ',
        coveredUpToMessageId: 'missing-id',
        tailStartMessageId: 'also-missing',
        messageCount: null,
        tokenCount: null,
        createdAt: new Date()
      })
    }

    const result = await ContextWindowBuilder.build(
      'session_1',
      sessionRepo as any,
      snapshotRepo as any,
      { recentCount: 0 }
    )

    expect(result).toEqual([])
  })

  it('keeps requiredMessageId turn when snapshot anchors are lost', async () => {
    const messages: MessageWithParts[] = [
      { ...makeMsg('user', 1), id: '1' },
      { ...makeMsg('assistant', 2), id: '2' },
      { ...makeMsg('user', 3), id: '3' },
      { ...makeMsg('assistant', 4), id: '4' },
      { ...makeMsg('user', 5), id: '5' }
    ]

    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue(messages)
    }
    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValue({
        id: 12,
        sessionId: 'session_1',
        summaryText: '摘要',
        coveredUpToMessageId: 'missing-id',
        tailStartMessageId: 'also-missing',
        messageCount: null,
        tokenCount: null,
        createdAt: new Date()
      })
    }

    const result = await ContextWindowBuilder.build(
      'session_1',
      sessionRepo as any,
      snapshotRepo as any,
      { recentCount: 0, requiredMessageId: '5' }
    )

    expect(result[0]?.isSummary).toBe(true)
    expect(result.map((m) => m.id)).toEqual(['snapshot_12', '5'])
  })
})
