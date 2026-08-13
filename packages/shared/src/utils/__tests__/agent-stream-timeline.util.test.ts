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
})
