import { describe, it, expect, vi } from 'vitest'
import {
  CHAT_ROUNDS_PER_PAGE,
  cacheNeedsMoreForRoundWindow,
  enrichCacheForRoundWindow,
  groupMessagesIntoRounds,
  flattenRoundSlice,
  computeInitialRoundWindowStart,
  expandRoundWindowStart,
  isRoundPageStart,
  leadingRoundNeedsParent
} from '../chat-round-pagination'

describe('chat-round-pagination', () => {
  it('groups messages by user turns', () => {
    const rounds = groupMessagesIntoRounds([
      { id: '1', role: 'user' },
      { id: '2', role: 'assistant' },
      { id: '3', role: 'user' },
      { id: '4', role: 'assistant' }
    ])
    expect(rounds).toHaveLength(2)
    expect(rounds[0]!.map((m) => m.id)).toEqual(['1', '2'])
    expect(rounds[1]!.map((m) => m.id)).toEqual(['3', '4'])
  })

  it('shows only tail rounds on initial window', () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      role: i % 2 === 0 ? 'user' : 'assistant'
    }))
    const rounds = groupMessagesIntoRounds(messages)
    const start = computeInitialRoundWindowStart(rounds.length)
    expect(start).toBe(rounds.length - CHAT_ROUNDS_PER_PAGE)
    expect(flattenRoundSlice(rounds, start)).toHaveLength(12)
  })

  it('expands window by CHAT_ROUNDS_PER_PAGE', () => {
    expect(expandRoundWindowStart(12)).toBe(6)
    expect(expandRoundWindowStart(2)).toBe(0)
    expect(expandRoundWindowStart(0)).toBe(0)
  })

  it('marks page boundaries every six rounds', () => {
    expect(isRoundPageStart(0)).toBe(true)
    expect(isRoundPageStart(6)).toBe(true)
    expect(isRoundPageStart(2)).toBe(false)
  })

  it('detects when leading round is missing its parent user message (OpenCode leadingTurnNeedsParent)', () => {
    expect(
      leadingRoundNeedsParent([
        { id: 'a0', role: 'assistant' },
        { id: 'u1', role: 'user' },
        { id: 'a1', role: 'assistant' }
      ])
    ).toBe(true)

    expect(
      leadingRoundNeedsParent([
        { id: 'u1', role: 'user' },
        { id: 'a1', role: 'assistant' }
      ])
    ).toBe(false)
  })

  it('enriches leading turn from older DB pages when boundary cuts a round in half', async () => {
    const initialCache = [
      { id: 'a1', role: 'assistant' },
      { id: 'u2', role: 'user' },
      { id: 'a2', role: 'assistant' },
      { id: 'u3', role: 'user' },
      { id: 'a3', role: 'assistant' }
    ]
    expect(cacheNeedsMoreForRoundWindow(initialCache, 3, true)).toBe(true)

    const fetchPage = vi.fn().mockResolvedValueOnce([
      { id: 'u0', role: 'user' },
      { id: 'a0', role: 'assistant' },
      { id: 'u1', role: 'user' }
    ])

    const enriched = await enrichCacheForRoundWindow({
      cache: initialCache,
      loadedFromEnd: initialCache.length,
      fetchHasMore: true,
      targetVisibleRounds: 3,
      fetchPage,
      pageLimit: 3
    })

    expect(fetchPage).toHaveBeenCalledTimes(1)
    const rounds = groupMessagesIntoRounds(enriched.cache)
    expect(rounds).toHaveLength(4)
    expect(rounds[1]!.map((m) => m.id)).toEqual(['u1', 'a1'])
    expect(leadingRoundNeedsParent(enriched.cache)).toBe(false)
  })
})
