import { describe, expect, it } from 'vitest'
import {
  AgentGateKind,
  AgentGateReply,
  AgentGateRequestStatus,
  type AgentGatePartData
} from '../../baishou-agent-gate'
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

function gatePart(
  partial: Partial<AgentGatePartData['request']> &
    Pick<AgentGatePartData['request'], 'id' | 'action'>
): AgentGatePartData {
  return {
    request: {
      sessionId: 's1',
      vaultName: 'Personal',
      status: AgentGateRequestStatus.Resolved,
      kind: AgentGateKind.Tool,
      title: partial.action,
      options: [],
      allowCustomInput: true,
      metadata: {},
      createdAt: 1,
      ...partial
    },
    resolution: {
      requestId: partial.id,
      reply: AgentGateReply.Always,
      resolvedAt: 2
    }
  }
}

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

  it('should place a permission confirmation immediately before its matching tool', () => {
    const timeline: AgentStreamTimelineItem[] = [
      { kind: 'reasoning', text: '先列日记' },
      {
        kind: 'tool',
        callId: 'c1',
        name: 'diary_list',
        status: 'completed',
        result: 'ok',
        durationMs: 40
      },
      { kind: 'reasoning', text: '再想' }
    ]
    const items = groupStreamTimelineForDisplay(timeline, [
      gatePart({ id: 'g1', action: 'diary_list', title: '列出日记', createdAt: 10 })
    ])
    expect(items.map((item) => item.kind)).toEqual(['reasoning', 'gate', 'tools', 'reasoning'])
    expect(items[1]).toMatchObject({ kind: 'gate' })
    if (items[1]?.kind !== 'gate') return
    expect(items[1].data.request.title).toBe('列出日记')
  })

  it('should keep an unanswered permission after thinking until the tool row exists', () => {
    const timeline: AgentStreamTimelineItem[] = [{ kind: 'reasoning', text: '先想' }]
    const items = groupStreamTimelineForDisplay(timeline, [
      gatePart({ id: 'g1', action: 'diary_list', title: '列出日记' })
    ])
    expect(items.map((item) => item.kind)).toEqual(['reasoning', 'gate'])
  })

  it('should split adjacent tools when each tool has its own permission confirmation', () => {
    const timeline: AgentStreamTimelineItem[] = [
      { kind: 'tool', callId: 'c1', name: 'diary_list', status: 'completed', result: 'a' },
      { kind: 'tool', callId: 'c2', name: 'diary_search', status: 'completed', result: 'b' }
    ]
    const items = groupStreamTimelineForDisplay(timeline, [
      gatePart({ id: 'g1', action: 'diary_list', toolCallId: 'c1' }),
      gatePart({ id: 'g2', action: 'diary_search', toolCallId: 'c2' })
    ])
    expect(items.map((item) => item.kind)).toEqual(['gate', 'tools', 'gate', 'tools'])
  })

  it('should skip companion_ask confirmation cards because the tool row already shows them', () => {
    const timeline: AgentStreamTimelineItem[] = [
      { kind: 'reasoning', text: '先想' },
      { kind: 'tool', callId: 'a1', name: 'companion_ask', status: 'running' }
    ]
    const items = groupStreamTimelineForDisplay(timeline, [
      gatePart({ id: 'g1', action: 'companion_ask', title: '提问' })
    ])
    expect(items.map((item) => item.kind)).toEqual(['reasoning', 'tools'])
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

  it('should interleave a trailing agent_gate part before the matching tool', () => {
    const items = buildAssistantDisplayTimelineFromParts([
      { id: 'r1', type: 'text', data: { text: '先想', isReasoning: true, seq: 0 } },
      {
        id: 'list',
        type: 'tool',
        data: { callId: 'c1', name: 'diary_list', status: 'completed', result: 'ok', seq: 1 }
      },
      { id: 'r2', type: 'text', data: { text: '再想', isReasoning: true, seq: 2 } },
      {
        id: 'g1',
        type: 'agent_gate',
        data: gatePart({ id: 'g1', action: 'diary_list', title: '列出日记', createdAt: 10 })
      }
    ])
    expect(items.map((item) => item.kind)).toEqual(['reasoning', 'gate', 'tools', 'reasoning'])
  })
})
