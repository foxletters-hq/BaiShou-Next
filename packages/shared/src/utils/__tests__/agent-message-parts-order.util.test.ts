import { describe, expect, it } from 'vitest'
import { sortAgentMessageParts } from '../agent-message-parts-order.util'

describe('sortAgentMessageParts', () => {
  it('orders by seq when present (even if array is shuffled)', () => {
    const ordered = sortAgentMessageParts([
      { id: 't', type: 'text', data: { text: 'answer', seq: 2 } },
      { id: 'r', type: 'text', data: { text: 'think', isReasoning: true, seq: 0 } },
      { id: 'c', type: 'tool', data: { name: 'skill_write', seq: 1 } }
    ])
    expect(ordered.map((p) => p.id)).toEqual(['r', 'c', 't'])
  })

  it('parses seq from JSON string data', () => {
    const ordered = sortAgentMessageParts([
      { id: 't', type: 'text', data: JSON.stringify({ text: 'answer', seq: 2 }) },
      { id: 'r', type: 'text', data: JSON.stringify({ text: 'think', isReasoning: true, seq: 0 }) },
      { id: 'c', type: 'tool', data: JSON.stringify({ name: 'skill_write', seq: 1 }) }
    ])
    expect(ordered.map((p) => p.id)).toEqual(['r', 'c', 't'])
  })

  it('falls back to reasoning → tool → text for legacy flat persist without seq', () => {
    const ordered = sortAgentMessageParts([
      { id: 't', type: 'text', data: { text: 'answer' } },
      { id: 'r', type: 'text', data: { text: 'think', isReasoning: true } },
      { id: 'c', type: 'tool', data: { name: 'skill_write' } }
    ])
    expect(ordered.map((p) => p.id)).toEqual(['r', 'c', 't'])
  })
})
