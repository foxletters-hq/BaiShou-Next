import { describe, expect, it } from 'vitest'
import {
  buildCompressibleRounds,
  sliceMessagesForRoundRange
} from '../agent/compression-round.utils'
import type { MessageWithParts } from '../agent/message.adapter'

function msg(
  id: string,
  role: 'user' | 'assistant',
  orderIndex: number,
  content: string
): MessageWithParts {
  return {
    id,
    sessionId: 's1',
    role,
    orderIndex,
    parts: [{ type: 'text', data: { text: content } }]
  } as MessageWithParts
}

describe('compression-round.utils', () => {
  it('buildCompressibleRounds groups by user turns before cutoff', () => {
    const messages = [
      msg('u1', 'user', 1, 'hello'),
      msg('a1', 'assistant', 2, 'hi'),
      msg('u2', 'user', 3, 'weather?'),
      msg('a2', 'assistant', 4, 'sunny'),
      msg('u3', 'user', 5, 'thanks')
    ]

    const rounds = buildCompressibleRounds(messages, 4)
    expect(rounds).toHaveLength(2)
    expect(rounds[0]!.roundIndex).toBe(1)
    expect(rounds[0]!.preview).toContain('hello')
    expect(rounds[1]!.preview).toContain('weather')
  })

  it('sliceMessagesForRoundRange returns inclusive order span', () => {
    const messages = [
      msg('u1', 'user', 1, 'a'),
      msg('a1', 'assistant', 2, 'b'),
      msg('u2', 'user', 3, 'c'),
      msg('a2', 'assistant', 4, 'd')
    ]
    const rounds = buildCompressibleRounds(messages)
    const slice = sliceMessagesForRoundRange(messages, rounds, 1, 2)
    expect(slice.map((m) => m.id)).toEqual(['u1', 'a1', 'u2', 'a2'])
  })
})
