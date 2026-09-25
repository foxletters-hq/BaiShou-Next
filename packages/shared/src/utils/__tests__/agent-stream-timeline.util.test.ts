import { describe, expect, it } from 'vitest'
import {
  appendTimelineReasoning,
  appendTimelineText,
  appendTimelineToolStart,
  completeTimelineTool,
  type AgentStreamTimelineItem
} from '../agent-stream-timeline.util'

describe('agent-stream-timeline.util', () => {
  it('builds interleaved timeline segments', () => {
    const timeline: AgentStreamTimelineItem[] = []
    appendTimelineReasoning(timeline, 'a')
    appendTimelineReasoning(timeline, 'b')
    appendTimelineToolStart(timeline, { callId: '1', name: 't', args: {} })
    completeTimelineTool(timeline, { callId: '1', result: 'ok' })
    appendTimelineReasoning(timeline, 'c')
    appendTimelineText(timeline, 'hello')

    expect(timeline.map((item) => item.kind)).toEqual(['reasoning', 'tool', 'reasoning', 'text'])
    expect(timeline[0]).toMatchObject({ kind: 'reasoning', text: 'ab' })
    expect(timeline[1]).toMatchObject({ kind: 'tool', status: 'completed', result: 'ok' })
    expect(timeline[2]).toMatchObject({ kind: 'reasoning', text: 'c' })
    expect(timeline[3]).toMatchObject({ kind: 'text', text: 'hello' })
  })

  it('should keep the first call position when the same tool-start is emitted again', () => {
    const timeline: AgentStreamTimelineItem[] = []
    appendTimelineToolStart(timeline, { callId: 't1', name: 'current_time', args: {} })
    appendTimelineToolStart(timeline, { callId: 't2', name: 'knowledge_search', args: { q: '天气' } })
    appendTimelineToolStart(timeline, {
      callId: 't1',
      name: 'current_time',
      args: {}
    })

    expect(timeline.filter((item) => item.kind === 'tool').map((item) => item.callId)).toEqual([
      't1',
      't2'
    ])
  })

  it('should keep a question when a later tool-start has empty args', () => {
    const timeline: AgentStreamTimelineItem[] = []
    appendTimelineToolStart(timeline, { callId: 'c1', name: 'companion_ask', args: {} })
    appendTimelineToolStart(timeline, {
      callId: 'c1',
      name: 'companion_ask',
      args: { question: '你在哪座城市？' }
    })
    appendTimelineToolStart(timeline, { callId: 'c1', name: 'companion_ask', args: {} })

    expect(timeline[0]).toMatchObject({
      kind: 'tool',
      arguments: { question: '你在哪座城市？' }
    })
  })
})
