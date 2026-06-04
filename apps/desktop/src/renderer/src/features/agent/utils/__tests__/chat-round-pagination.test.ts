import { describe, it, expect } from 'vitest'
import {
  CHAT_ROUNDS_PER_PAGE,
  groupMessagesIntoRounds,
  flattenRoundSlice,
  computeInitialRoundWindowStart,
  expandRoundWindowStart,
  isRoundPageStart
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
    const messages = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      role: i % 2 === 0 ? 'user' : 'assistant'
    }))
    const rounds = groupMessagesIntoRounds(messages)
    const start = computeInitialRoundWindowStart(rounds.length)
    expect(start).toBe(rounds.length - CHAT_ROUNDS_PER_PAGE)
    expect(flattenRoundSlice(rounds, start)).toHaveLength(6)
  })

  it('expands window by CHAT_ROUNDS_PER_PAGE', () => {
    expect(expandRoundWindowStart(6)).toBe(3)
    expect(expandRoundWindowStart(2)).toBe(0)
    expect(expandRoundWindowStart(0)).toBe(0)
  })

  it('marks page boundaries every three rounds', () => {
    expect(isRoundPageStart(0)).toBe(true)
    expect(isRoundPageStart(3)).toBe(true)
    expect(isRoundPageStart(2)).toBe(false)
  })
})
