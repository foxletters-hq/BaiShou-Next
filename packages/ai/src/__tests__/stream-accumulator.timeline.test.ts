import { describe, expect, it, vi } from 'vitest'
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
      expect.objectContaining({
        type: 'tool',
        callId: 'c1',
        name: 'read_file',
        arguments: JSON.stringify({ path: 'a.ts' }),
        result: 'ok',
        status: 'completed',
        seq: 1
      }),
      { type: 'text', text: 'think2', isReasoning: true, seq: 2 },
      { type: 'text', text: 'final', seq: 3 }
    ])
  })

  it('should persist tool durationMs when the tool-result arrives later', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1_000)
      const acc = new StreamAccumulator()
      acc.add({
        type: 'tool-call',
        toolCallId: 'c1',
        toolName: 'diary_search',
        input: { q: '雨' }
      } as any)
      vi.setSystemTime(1_157)
      acc.add({
        type: 'tool-result',
        toolCallId: 'c1',
        toolName: 'diary_search',
        output: 'ok'
      } as any)

      const tool = acc.timeline.find((item) => item.kind === 'tool')
      expect(tool).toMatchObject({ durationMs: 157 })

      const parts = buildAssistantPartsFromTimeline({
        accumulator: acc,
        assistantMsgId: 'msg',
        sessionId: 'sess'
      })
      expect(parts.find((part) => part.type === 'tool')?.data).toEqual(
        expect.objectContaining({
          callId: 'c1',
          durationMs: 157
        })
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('should persist tools in call order when a later call finishes first', () => {
    const acc = new StreamAccumulator()
    acc.add({ type: 'tool-input-start', id: 't1', toolName: 'current_time' } as any)
    acc.add({
      type: 'tool-input-start',
      id: 't2',
      toolName: 'knowledge_search'
    } as any)
    acc.add({
      type: 'tool-result',
      toolCallId: 't2',
      toolName: 'knowledge_search',
      output: '晴'
    } as any)
    acc.add({
      type: 'tool-call',
      toolCallId: 't2',
      toolName: 'knowledge_search',
      input: { q: '天气' }
    } as any)
    acc.add({
      type: 'tool-result',
      toolCallId: 't1',
      toolName: 'current_time',
      output: 'now'
    } as any)
    acc.add({
      type: 'tool-call',
      toolCallId: 't1',
      toolName: 'current_time',
      input: {}
    } as any)

    expect(
      acc.timeline.filter((item) => item.kind === 'tool').map((item) => item.callId)
    ).toEqual(['t1', 't2'])

    const parts = buildAssistantPartsFromTimeline({
      accumulator: acc,
      assistantMsgId: 'msg',
      sessionId: 'sess'
    })
    expect(parts.filter((part) => part.type === 'tool').map((part) => part.data.callId)).toEqual([
      't1',
      't2'
    ])
  })

  it('should persist a waiting companion_ask as running, not failed', () => {
    const acc = new StreamAccumulator()
    acc.add({
      type: 'tool-call',
      toolCallId: 'ask-1',
      toolName: 'companion_ask',
      input: { question: '继续吗？', options: ['是', '否'] }
    } as any)

    const parts = buildAssistantPartsFromTimeline({
      accumulator: acc,
      assistantMsgId: 'msg',
      sessionId: 'sess'
    })
    const toolPart = parts.find((part) => part.type === 'tool')
    expect(toolPart?.data).toEqual(
      expect.objectContaining({
        callId: 'ask-1',
        name: 'companion_ask',
        status: 'running'
      })
    )
  })
})
