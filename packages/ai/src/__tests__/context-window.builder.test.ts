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
})
