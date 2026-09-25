import { describe, expect, it } from 'vitest'
import {
  appendTimelineReasoning,
  appendTimelineToolStart,
  type AgentStreamTimelineItem
} from '../agent-stream-timeline.util'
import {
  assistantStreamTimelineSignature,
  buildAssistantDisplayTimelineFromParts,
  groupStreamTimelineForDisplay
} from '../assistant-display-timeline.util'

describe('assistantStreamTimelineSignature', () => {
  it('should change when the same array is appended in place', () => {
    const timeline: AgentStreamTimelineItem[] = []
    const empty = assistantStreamTimelineSignature(timeline)
    appendTimelineReasoning(timeline, '先想')
    const afterThink = assistantStreamTimelineSignature(timeline)
    appendTimelineToolStart(timeline, { callId: 's1', name: 'diary_search' })
    appendTimelineReasoning(timeline, '再想')
    const afterToolThink = assistantStreamTimelineSignature(timeline)
    expect(empty).not.toBe(afterThink)
    expect(afterThink).not.toBe(afterToolThink)
    expect(groupStreamTimelineForDisplay(timeline).map((item) => item.kind)).toEqual([
      'reasoning',
      'tools',
      'reasoning'
    ])
  })
})

describe('groupStreamTimelineForDisplay', () => {
  it('should keep think → tool → think → text order when grouping adjacent tools', () => {
    const timeline: AgentStreamTimelineItem[] = [
      { kind: 'reasoning', text: '先想查谁' },
      {
        kind: 'tool',
        callId: 's1',
        name: 'diary_search',
        arguments: { q: '李四' },
        status: 'completed',
        result: 'ok',
        durationMs: 12
      },
      { kind: 'reasoning', text: '查完再问' },
      {
        kind: 'tool',
        callId: 'a1',
        name: 'companion_ask',
        arguments: { question: '哪次' },
        status: 'running'
      },
      { kind: 'text', text: '是上周那次' }
    ]

    expect(groupStreamTimelineForDisplay(timeline).map((item) => item.kind)).toEqual([
      'reasoning',
      'tools',
      'reasoning',
      'tools',
      'text'
    ])
  })

  it('should merge adjacent tools into one group', () => {
    const timeline: AgentStreamTimelineItem[] = [
      { kind: 'tool', callId: '1', name: 'diary_search', status: 'completed', result: 'a' },
      { kind: 'tool', callId: '2', name: 'web_search', status: 'running' }
    ]
    const grouped = groupStreamTimelineForDisplay(timeline)
    expect(grouped).toHaveLength(1)
    expect(grouped[0]?.kind).toBe('tools')
    if (grouped[0]?.kind !== 'tools') return
    expect(grouped[0].completedTools.map((tool) => tool.name)).toEqual(['diary_search'])
    expect(grouped[0].activeToolName).toBe('web_search')
  })
})

describe('buildAssistantDisplayTimelineFromParts', () => {
  it('should rebuild interleaved think / tool / think / text from seq-ordered parts', () => {
    const items = buildAssistantDisplayTimelineFromParts([
      {
        id: 't2',
        type: 'text',
        data: { text: '是上周那次', seq: 4 }
      },
      {
        id: 'ask',
        type: 'tool',
        data: { callId: 'a1', name: 'companion_ask', status: 'completed', result: '答了', seq: 3 }
      },
      {
        id: 'r2',
        type: 'text',
        data: { text: '查完再问', isReasoning: true, seq: 2 }
      },
      {
        id: 'search',
        type: 'tool',
        data: { callId: 's1', name: 'diary_search', status: 'completed', result: 'ok', seq: 1 }
      },
      {
        id: 'r1',
        type: 'text',
        data: { text: '先想查谁', isReasoning: true, seq: 0 }
      }
    ])

    expect(items.map((item) => item.kind)).toEqual([
      'reasoning',
      'tools',
      'reasoning',
      'tools',
      'text'
    ])
    expect(items[0]).toMatchObject({ kind: 'reasoning', text: '先想查谁' })
    expect(items[2]).toMatchObject({ kind: 'reasoning', text: '查完再问' })
    expect(items[4]).toMatchObject({ kind: 'text', text: '是上周那次' })
  })

  it('should keep persisted tool durationMs instead of rewriting it to 0', () => {
    const items = buildAssistantDisplayTimelineFromParts([
      {
        id: 'search',
        type: 'tool',
        data: {
          callId: 's1',
          name: 'diary_search',
          status: 'completed',
          result: 'ok',
          durationMs: 157,
          seq: 0
        }
      }
    ])
    expect(items).toHaveLength(1)
    expect(items[0]?.kind).toBe('tools')
    if (items[0]?.kind !== 'tools') return
    expect(items[0].completedTools[0]?.durationMs).toBe(157)
  })

  it('should skip emoji_send tool parts', () => {
    const items = buildAssistantDisplayTimelineFromParts([
      { id: 'r', type: 'text', data: { text: '想', isReasoning: true, seq: 0 } },
      { id: 'e', type: 'tool', data: { callId: 'e1', name: 'emoji_send', seq: 1 } },
      { id: 't', type: 'text', data: { text: '好', seq: 2 } }
    ])
    expect(items.map((item) => item.kind)).toEqual(['reasoning', 'text'])
  })
})
