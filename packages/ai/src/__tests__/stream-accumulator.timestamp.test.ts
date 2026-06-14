import { describe, it, expect } from 'vitest'
import { StreamAccumulator } from '../agent/stream-accumulator'

describe('StreamAccumulator text getter', () => {
  it('strips leaked message-content wrapper from streamed assistant text', () => {
    const acc = new StreamAccumulator()
    acc.add({
      type: 'text-delta',
      textDelta:
        '<message-time>2026-01-15 10:00</message-time>\n<message-content>\n你好\n</message-content>'
    } as any)
    expect(acc.text).toBe('你好')
  })
})
