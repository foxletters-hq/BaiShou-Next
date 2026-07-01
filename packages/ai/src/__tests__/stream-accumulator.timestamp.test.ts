import { describe, it, expect } from 'vitest'
import { StreamAccumulator } from '../agent/stream-accumulator'

describe('StreamAccumulator text getter', () => {
  it('keeps raw streamed text on text and strips metadata on sanitizedText', () => {
    const acc = new StreamAccumulator()
    const leaked =
      '<message-time>2026-01-15 10:00</message-time>\n<message-content>\n你好\n</message-content>'
    acc.add({
      type: 'text-delta',
      textDelta: leaked
    } as any)
    expect(acc.text).toBe(leaked)
    expect(acc.sanitizedText).toBe('你好')
  })
})
