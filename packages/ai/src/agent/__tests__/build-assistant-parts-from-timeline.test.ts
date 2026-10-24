import { describe, it, expect } from 'vitest'
import { buildAssistantPartsFromTimeline } from '../build-assistant-parts-from-timeline'
import { StreamAccumulator } from '../stream-accumulator'

describe('buildAssistantPartsFromTimeline thinking extraction', () => {
  it('splits embedded think tags inside a text timeline item into reasoning and text parts', () => {
    const accumulator = new StreamAccumulator()
    accumulator.add({
      type: 'text-delta',
      textDelta: '<think>正在分析用户需求...\n分析完毕。</think>您好，这里是处理结果。'
    })

    const parts = buildAssistantPartsFromTimeline({
      accumulator,
      assistantMsgId: 'msg-1',
      sessionId: 'session-1'
    })

    expect(parts.length).toBe(2)
    expect(parts[0]).toMatchObject({
      type: 'text',
      data: {
        text: '正在分析用户需求...\n分析完毕。',
        isReasoning: true,
        seq: 0
      }
    })
    expect(parts[1]).toMatchObject({
      type: 'text',
      data: {
        text: '您好，这里是处理结果。',
        seq: 1
      }
    })
    expect((parts[1]?.data as Record<string, unknown>)['isReasoning']).toBeUndefined()
  })

  it('preserves native reasoning timeline items and normal text without alteration', () => {
    const accumulator = new StreamAccumulator()
    accumulator.add({
      type: 'reasoning-delta',
      textDelta: '原生思考流'
    })
    accumulator.add({
      type: 'text-delta',
      textDelta: '原生正文流'
    })

    const parts = buildAssistantPartsFromTimeline({
      accumulator,
      assistantMsgId: 'msg-2',
      sessionId: 'session-1'
    })

    expect(parts.length).toBe(2)
    expect(parts[0]).toMatchObject({
      type: 'text',
      data: {
        text: '原生思考流',
        isReasoning: true,
        seq: 0
      }
    })
    expect(parts[1]).toMatchObject({
      type: 'text',
      data: {
        text: '原生正文流',
        seq: 1
      }
    })
  })

  it('splits embedded think tags on fallback timeline-empty path', () => {
    // Force timeline to empty but text to have think tags via mock/direct
    const emptyTimelineAcc = {
      timeline: [],
      reasoning: '',
      text: '<think>降级思考</think>降级正文',
      toolCalls: [],
      toolResults: []
    } as unknown as StreamAccumulator

    const parts = buildAssistantPartsFromTimeline({
      accumulator: emptyTimelineAcc,
      assistantMsgId: 'msg-3',
      sessionId: 'session-1'
    })

    expect(parts.length).toBe(2)
    expect(parts[0]).toMatchObject({
      type: 'text',
      data: {
        text: '降级思考',
        isReasoning: true,
        seq: 0
      }
    })
    expect(parts[1]).toMatchObject({
      type: 'text',
      data: {
        text: '降级正文',
        seq: 1
      }
    })
  })
})
