import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CompressionPruneService } from '../agent/compression-prune.service'
import type { MessageWithParts } from '../agent/message.adapter'
import { PRUNE_PROTECT_USER_TURNS, TOOL_PAYLOAD_MAX_BYTES } from '../agent/compression.constants'

function makeToolPart(id: string, messageId: string, name: string, data: Record<string, unknown>) {
  return {
    id,
    messageId,
    sessionId: 's1',
    type: 'tool' as const,
    data: { callId: id, name, status: 'completed', ...data }
  }
}

function makeUserMsg(id: string, orderIndex: number): MessageWithParts {
  return {
    id,
    sessionId: 's1',
    role: 'user',
    isSummary: false,
    orderIndex,
    createdAt: new Date(),
    parts: [{ id: `p-${id}`, messageId: id, sessionId: 's1', type: 'text', data: { text: id } }]
  }
}

function makeAssistantMsg(
  id: string,
  orderIndex: number,
  parts: MessageWithParts['parts']
): MessageWithParts {
  return {
    id,
    sessionId: 's1',
    role: 'assistant',
    isSummary: false,
    orderIndex,
    createdAt: new Date(),
    parts
  }
}

describe('CompressionPruneService', () => {
  let updatePartsDataById: ReturnType<typeof vi.fn>

  beforeEach(() => {
    updatePartsDataById = vi.fn().mockResolvedValue(undefined)
  })

  it('prunes diary_write content older than protect window', async () => {
    const oldContent = 'x'.repeat(800)
    const messages: MessageWithParts[] = [
      makeUserMsg('u-old', 1),
      makeAssistantMsg('a-old', 2, [
        makeToolPart('tool-old', 'a-old', 'diary_write', {
          arguments: { date: '2026-01-01', content: oldContent }
        })
      ]),
      ...Array.from({ length: PRUNE_PROTECT_USER_TURNS }, (_, i) => {
        const idx = i + 1
        const uid = `u-${idx}`
        const aid = `a-${idx}`
        return [
          makeUserMsg(uid, idx * 2 + 1),
          makeAssistantMsg(aid, idx * 2 + 2, [
            makeToolPart(`tool-${idx}`, aid, 'diary_write', {
              arguments: { date: `2026-06-0${idx}`, content: 'recent' }
            })
          ])
        ]
      }).flat()
    ]

    const sessionRepo = { updatePartsDataById } as any
    const count = await CompressionPruneService.pruneSession(sessionRepo, 's1', messages)

    expect(count).toBe(1)
    expect(updatePartsDataById).toHaveBeenCalledTimes(1)
    const updates = updatePartsDataById.mock.calls[0]![0] as Array<{ id: string; data: unknown }>
    expect(updates).toHaveLength(1)
    expect(updates[0]?.id).toBe('tool-old')
    const args = (updates[0]?.data as { arguments: Record<string, unknown> }).arguments
    expect(args.content).toBeUndefined()
    expect(args.contentPruned).toBe(true)
  })

  it('keeps recent user-turn tool payload intact', async () => {
    const messages: MessageWithParts[] = [
      makeUserMsg('u-1', 1),
      makeAssistantMsg('a-1', 2, [
        makeToolPart('tool-1', 'a-1', 'diary_write', {
          arguments: { date: '2026-06-01', content: 'recent-only' }
        })
      ])
    ]

    const sessionRepo = { updatePartsDataById } as any
    const count = await CompressionPruneService.pruneSession(sessionRepo, 's1', messages)
    expect(count).toBe(0)
    expect(updatePartsDataById).not.toHaveBeenCalled()
  })

  it('prunes oversized payload even inside protect window', async () => {
    const huge = 'y'.repeat(TOOL_PAYLOAD_MAX_BYTES)
    const messages: MessageWithParts[] = [
      makeUserMsg('u-1', 1),
      makeAssistantMsg('a-1', 2, [
        makeToolPart('tool-huge', 'a-1', 'diary_write', {
          arguments: { date: '2026-06-01', content: huge }
        })
      ])
    ]

    const sessionRepo = { updatePartsDataById } as any
    const count = await CompressionPruneService.pruneSession(sessionRepo, 's1', messages)
    expect(count).toBe(1)
    expect(updatePartsDataById).toHaveBeenCalledTimes(1)
  })
})
