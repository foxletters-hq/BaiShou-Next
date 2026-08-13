import { describe, expect, it } from 'vitest'
import { StreamAccumulator } from '../agent/stream-accumulator'
import { buildAssistantPartsFromTimeline } from '../agent/build-assistant-parts-from-timeline'

describe('StreamAccumulator interleaved timeline', () => {
  it('keeps reasoning → tool → reasoning → text order', () => {
    const acc = new StreamAccumulator()
    acc.add({ type: 'reasoning-delta', textDelta: 'think1' } as any)
    acc.add({
      type: 'tool-call',
      toolCallId: 'c1',
      toolName: 'read_file',
      input: { path: 'a.ts' }
    } as any)
    acc.add({
      type: 'tool-result',
      toolCallId: 'c1',
      toolName: 'read_file',
      output: 'ok'
    } as any)
    acc.add({ type: 'reasoning-delta', textDelta: 'think2' } as any)
    acc.add({ type: 'text-delta', textDelta: 'final' } as any)

    expect(acc.timeline.map((item) => item.kind)).toEqual([
      'reasoning',
      'tool',
      'reasoning',
      'text'
    ])
    expect(acc.reasoning).toBe('think1\nthink2')
    expect(acc.text).toBe('final')

    const parts = buildAssistantPartsFromTimeline({
      accumulator: acc,
      assistantMsgId: 'msg',
      sessionId: 'sess'
    })
    expect(parts.map((part) => ({ type: part.type, ...(part.data as object) }))).toEqual([
      { type: 'text', text: 'think1', isReasoning: true, seq: 0 },
      {
        type: 'tool',
        callId: 'c1',
        name: 'read_file',
        arguments: JSON.stringify({ path: 'a.ts' }),
        result: 'ok',
        status: 'completed',
        seq: 1
      },
      { type: 'text', text: 'think2', isReasoning: true, seq: 2 },
      { type: 'text', text: 'final', seq: 3 }
    ])
  })
})
