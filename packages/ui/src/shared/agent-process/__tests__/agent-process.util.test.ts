import { describe, expect, it } from 'vitest'
import {
  AGENT_PROCESS_ACTIVE_PHRASES,
  AGENT_PROCESS_COMPLETED_PHRASES,
  AGENT_PROCESS_ROTATE_INTERVAL_MS,
  coalesceTimelineItemsForDisplay,
  formatAgentProcessTitle,
  isAskOnlyToolsItem,
  pickNextAgentProcessPhraseIndex
} from '../agent-process.util'
import type { AssistantDisplayTimelineItem } from '@baishou/shared'

type ToolsItem = Extract<AssistantDisplayTimelineItem, { kind: 'tools' }>

describe('formatAgentProcessTitle', () => {
  it('uses an 8-second rotation interval and rich active/completed phrase pools', () => {
    expect(AGENT_PROCESS_ROTATE_INTERVAL_MS).toBe(8000)
    expect(AGENT_PROCESS_ACTIVE_PHRASES.length).toBeGreaterThanOrEqual(25)
    expect(AGENT_PROCESS_COMPLETED_PHRASES.length).toBeGreaterThanOrEqual(15)
  })

  it('formats playful active title during streaming before text (default index 0)', () => {
    const title = formatAgentProcessTitle({
      hasReasoning: true,
      completedToolsCount: 1,
      isStreaming: true,
      hasAnswerText: false,
      activeToolName: 'diary_search'
    })
    expect(title).toBe('伙伴正在喝茶…')
  })

  it('cycles through active phrases by phraseIndex during streaming', () => {
    const title1 = formatAgentProcessTitle({
      hasReasoning: true,
      completedToolsCount: 0,
      isStreaming: true,
      hasAnswerText: false,
      phraseIndex: 1
    })
    expect(title1).toBe('伙伴正在打盹…')

    const titleWrapped = formatAgentProcessTitle({
      hasReasoning: true,
      completedToolsCount: 0,
      isStreaming: true,
      hasAnswerText: false,
      phraseIndex: AGENT_PROCESS_ACTIVE_PHRASES.length + 2
    })
    expect(titleWrapped).toBe(AGENT_PROCESS_ACTIVE_PHRASES[2]!.fallback)
  })

  it('localizes active phrase via i18n when t is provided', () => {
    const t = (key: string, fallback?: string) =>
      key === 'agent.chat.process_active_phrase_0' ? 'Companion is sipping tea…' : (fallback ?? key)

    const title = formatAgentProcessTitle({
      hasReasoning: true,
      completedToolsCount: 0,
      isStreaming: true,
      hasAnswerText: false,
      phraseIndex: 0,
      t
    })
    expect(title).toBe('Companion is sipping tea…')
  })

  it('formats playful completed phrase when answered or streaming finished', () => {
    const title0 = formatAgentProcessTitle({
      hasReasoning: true,
      completedToolsCount: 3,
      totalDurationMs: 2400,
      isStreaming: false,
      hasAnswerText: true,
      phraseIndex: 0
    })
    expect(title0).toBe('伙伴喝完茶回来啦')

    const title1 = formatAgentProcessTitle({
      hasReasoning: false,
      completedToolsCount: 2,
      totalDurationMs: 850,
      isStreaming: true,
      hasAnswerText: true,
      phraseIndex: 1
    })
    expect(title1).toBe('伙伴整理好思绪啦')

    const titleWrapped = formatAgentProcessTitle({
      hasReasoning: true,
      completedToolsCount: 0,
      isStreaming: false,
      hasAnswerText: true,
      phraseIndex: AGENT_PROCESS_COMPLETED_PHRASES.length + 3
    })
    expect(titleWrapped).toBe(AGENT_PROCESS_COMPLETED_PHRASES[3]!.fallback)
  })

  it('falls back to classic titles when playfulStatus is false', () => {
    expect(
      formatAgentProcessTitle({
        hasReasoning: true,
        completedToolsCount: 1,
        isStreaming: true,
        hasAnswerText: false,
        activeToolName: 'diary_search',
        playfulStatus: false
      })
    ).toBe('正在执行：diary_search…')

    expect(
      formatAgentProcessTitle({
        hasReasoning: true,
        completedToolsCount: 0,
        isStreaming: true,
        hasAnswerText: false,
        isThinkLoading: true,
        playfulStatus: false
      })
    ).toBe('深度思考中…')

    expect(
      formatAgentProcessTitle({
        hasReasoning: true,
        completedToolsCount: 3,
        isStreaming: false,
        hasAnswerText: true,
        playfulStatus: false
      })
    ).toBe('思考完成，完成3项操作')
  })
})

describe('pickNextAgentProcessPhraseIndex', () => {
  it('returns 0 when length <= 1', () => {
    expect(pickNextAgentProcessPhraseIndex(1)).toBe(0)
    expect(pickNextAgentProcessPhraseIndex(0)).toBe(0)
  })

  it('always avoids repeating the previous index when length > 1', () => {
    for (let i = 0; i < 30; i += 1) {
      const next = pickNextAgentProcessPhraseIndex(AGENT_PROCESS_ACTIVE_PHRASES.length, 4)
      expect(next).not.toBe(4)
      expect(next).toBeGreaterThanOrEqual(0)
      expect(next).toBeLessThan(AGENT_PROCESS_ACTIVE_PHRASES.length)
    }
  })
})

describe('coalesceTimelineItemsForDisplay', () => {
  const tools = (key: string, name: string, extra?: Partial<ToolsItem>): ToolsItem => ({
    kind: 'tools',
    key,
    invocations: [],
    completedTools: [{ name, durationMs: 20 }],
    ...extra
  })

  it('merges adjacent reasoning and tools into one process segment before the answer text', () => {
    const items: AssistantDisplayTimelineItem[] = [
      { kind: 'reasoning', key: 'r1', text: '先想一下' },
      tools('t1', 'read_file'),
      { kind: 'text', key: 'txt1', text: '最终回答内容' }
    ]

    const coalesced = coalesceTimelineItemsForDisplay(items)
    expect(coalesced.map((c) => c.kind)).toEqual(['process', 'text'])
    const process = coalesced[0]!
    expect(process.kind).toBe('process')
    if (process.kind === 'process') {
      expect(process.key).toBe('proc-r1')
      expect(process.steps.map((s) => s.key)).toEqual(['r1', 't1'])
      expect(process.hasSubsequentText).toBe(true)
      expect(process.hasPrecedingText).toBe(false)
    }
  })

  it('never folds visible text into a process segment; text splits work into chronological segments', () => {
    const items: AssistantDisplayTimelineItem[] = [
      { kind: 'reasoning', key: 'r1', text: '先查第一轮图谱' },
      tools('t1', 'recall_relations'),
      { kind: 'text', key: 'txt1', text: '关系图里确实有东西，我再逐一查过。' },
      tools('t2', 'recall_relations'),
      { kind: 'text', key: 'txt2', text: '关系图比预想的大很多，我再补查两轮。' },
      tools('t3', 'recall_relations', { activeToolName: 'recall_relations' }),
      { kind: 'reasoning', key: 'r2', text: '整理完整节点与边的汇报结构' }
    ]

    const coalesced = coalesceTimelineItemsForDisplay(items)
    expect(coalesced.map((c) => c.key)).toEqual(['proc-r1', 'txt1', 'proc-t2', 'txt2', 'proc-t3'])

    const last = coalesced[4]!
    expect(last.kind).toBe('process')
    if (last.kind === 'process') {
      expect(last.steps.map((s) => s.key)).toEqual(['t3', 'r2'])
      expect(last.hasSubsequentText).toBe(false)
      expect(last.hasPrecedingText).toBe(true)
    }
    const middle = coalesced[2]!
    if (middle.kind === 'process') {
      expect(middle.hasSubsequentText).toBe(true)
      expect(middle.hasPrecedingText).toBe(true)
    }
  })

  it('keeps a long report, the companion_ask card and the closing text in chronological order', () => {
    const report = ['图谱节点如下：', '- 白守用户', '- 深度关系'].join('\n')
    const items: AssistantDisplayTimelineItem[] = [
      { kind: 'reasoning', key: 'r1', text: '先查图数据库' },
      tools('t1', 'recall_relations'),
      { kind: 'text', key: 'txt1', text: report },
      tools('ask1', 'companion_ask'),
      { kind: 'reasoning', key: 'r2', text: '收到回答' },
      { kind: 'text', key: 'txt2', text: '好，那就先这样。' }
    ]

    const coalesced = coalesceTimelineItemsForDisplay(items)
    expect(coalesced.map((c) => `${c.kind}:${c.key}`)).toEqual([
      'process:proc-r1',
      'text:txt1',
      'tools:ask1',
      'process:proc-r2',
      'text:txt2'
    ])
  })

  it('shows a short transition text followed by companion_ask inline as well', () => {
    const items: AssistantDisplayTimelineItem[] = [
      { kind: 'text', key: 'txt1', text: '我问你一下。' },
      tools('ask1', 'companion_ask', { activeToolName: 'companion_ask', completedTools: [] })
    ]

    const coalesced = coalesceTimelineItemsForDisplay(items)
    expect(coalesced.map((c) => `${c.kind}:${c.key}`)).toEqual(['text:txt1', 'tools:ask1'])
  })

  it('keeps reply text visible when trailing tools or reasoning follow without new text', () => {
    const items: AssistantDisplayTimelineItem[] = [
      { kind: 'reasoning', key: 'r1', text: '先思考回复内容' },
      { kind: 'text', key: 'txt1', text: '已经回复给用户的一半正文内容' },
      tools('t1', 'memory_store'),
      { kind: 'reasoning', key: 'r2', text: '工具执行后续轮思考但未再输出正文' }
    ]

    const coalesced = coalesceTimelineItemsForDisplay(items)
    expect(coalesced.map((c) => `${c.kind}:${c.key}`)).toEqual([
      'process:proc-r1',
      'text:txt1',
      'process:proc-t1'
    ])
    const trailing = coalesced[2]!
    if (trailing.kind === 'process') {
      expect(trailing.hasSubsequentText).toBe(false)
      expect(trailing.steps.map((s) => s.key)).toEqual(['t1', 'r2'])
    }
  })

  it('keeps permission gate records inside the process segment', () => {
    const gateItem: AssistantDisplayTimelineItem = {
      kind: 'gate',
      key: 'g1',
      data: {
        request: {
          id: '1',
          sessionId: 's1',
          vaultName: 'v',
          title: '保存 Skill',
          action: 'skill_save',
          kind: 1 as any,
          status: 2 as any,
          options: [],
          allowCustomInput: false,
          metadata: {},
          createdAt: 1
        }
      } as any
    }

    const items: AssistantDisplayTimelineItem[] = [
      { kind: 'reasoning', key: 'r1', text: '想' },
      gateItem,
      tools('t1', 'skill_save'),
      { kind: 'text', key: 'txt1', text: '保存成功！' }
    ]

    const coalesced = coalesceTimelineItemsForDisplay(items)
    expect(coalesced.map((c) => c.kind)).toEqual(['process', 'text'])
    if (coalesced[0]!.kind === 'process') {
      expect(coalesced[0]!.gateItems).toHaveLength(1)
      expect(coalesced[0]!.steps.map((s) => s.kind)).toEqual(['reasoning', 'gate', 'tools'])
    }
  })

  it('splits redacted thinking embedded in text into the process segment before the visible text', () => {
    const items: AssistantDisplayTimelineItem[] = [
      { kind: 'text', key: 'txt1', text: '<think>内部推理</think>这是正文' }
    ]

    const coalesced = coalesceTimelineItemsForDisplay(items)
    expect(coalesced.map((c) => `${c.kind}:${c.key}`)).toEqual([
      'process:proc-txt1:reasoning',
      'text:txt1'
    ])
    if (coalesced[1]!.kind === 'text') {
      expect(coalesced[1]!.text).toBe('这是正文')
    }
  })

  it('returns plain text only when there is no work at all', () => {
    const coalesced = coalesceTimelineItemsForDisplay([{ kind: 'text', key: 'txt1', text: '你好' }])
    expect(coalesced.map((c) => c.kind)).toEqual(['text'])
  })
})

describe('isAskOnlyToolsItem', () => {
  it('detects companion_ask-only tool groups', () => {
    expect(
      isAskOnlyToolsItem({
        kind: 'tools',
        key: 'a',
        invocations: [],
        completedTools: [{ name: 'companion_ask', durationMs: 1 }]
      })
    ).toBe(true)
    expect(
      isAskOnlyToolsItem({
        kind: 'tools',
        key: 'b',
        invocations: [],
        completedTools: [
          { name: 'companion_ask', durationMs: 1 },
          { name: 'diary_search', durationMs: 1 }
        ]
      })
    ).toBe(false)
  })
})
