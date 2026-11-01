import { describe, expect, it } from 'vitest'
import {
  AGENT_PROCESS_ACTIVE_PHRASES,
  AGENT_PROCESS_COMPLETED_PHRASES,
  AGENT_PROCESS_ROTATE_INTERVAL_MS,
  coalesceTimelineItemsForDisplay,
  formatAgentProcessTitle,
  pickNextAgentProcessPhraseIndex
} from '../agent-process.util'
import type { AssistantDisplayTimelineItem } from '@baishou/shared'

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
  it('merges adjacent reasoning and tools into a single process item', () => {
    const items: AssistantDisplayTimelineItem[] = [
      { kind: 'reasoning', key: 'r1', text: '先想一下' },
      {
        kind: 'tools',
        key: 't1',
        invocations: [],
        completedTools: [{ name: 'read_file', durationMs: 20 }]
      },
      { kind: 'text', key: 'txt1', text: '最终回答内容' }
    ]

    const coalesced = coalesceTimelineItemsForDisplay(items)
    expect(coalesced).toHaveLength(2)
    expect(coalesced[0]!.kind).toBe('process')
    if (coalesced[0]!.kind === 'process') {
      expect(coalesced[0]!.reasoningItems).toHaveLength(1)
      expect(coalesced[0]!.reasoningItems[0]!.text).toBe('先想一下')
      expect(coalesced[0]!.toolsItems).toHaveLength(1)
      expect(coalesced[0]!.hasSubsequentText).toBe(true)
      expect(coalesced[0]!.hasPrecedingText).toBe(false)
    }
    expect(coalesced[1]!.kind).toBe('text')
  })

  it('folds intermediate text before tools into the single process item', () => {
    const items: AssistantDisplayTimelineItem[] = [
      { kind: 'reasoning', key: 'r1', text: '先看现状' },
      {
        kind: 'tools',
        key: 't1',
        invocations: [],
        completedTools: [{ name: 'diary_list', durationMs: 1300 }]
      },
      {
        kind: 'text',
        key: 'txt1',
        text: '让我先看看今天的日记现状，同时把能并行跑的检查一次跑完。'
      },
      {
        kind: 'tools',
        key: 't2',
        activeToolName: 'vector_search',
        completedTools: [{ name: 'diary_search', durationMs: 1100 }]
      },
      { kind: 'reasoning', key: 'r2', text: '汇总结果' },
      { kind: 'text', key: 'txt2', text: '这是最终整理好的回答。' }
    ]

    const coalesced = coalesceTimelineItemsForDisplay(items)
    expect(coalesced).toHaveLength(2)

    expect(coalesced[0]!.kind).toBe('process')
    if (coalesced[0]!.kind === 'process') {
      expect(coalesced[0]!.hasSubsequentText).toBe(true)
      expect(coalesced[0]!.hasPrecedingText).toBe(false)
      expect(coalesced[0]!.reasoningItems).toHaveLength(2)
      expect(coalesced[0]!.toolsItems).toHaveLength(2)
      expect(coalesced[0]!.textItems).toHaveLength(1)
      expect(coalesced[0]!.textItems[0]!.text).toContain('让我先看看今天的日记现状')
      expect(coalesced[0]!.steps.map((s) => s.kind)).toEqual([
        'reasoning',
        'tools',
        'text',
        'tools',
        'reasoning'
      ])
    }

    expect(coalesced[1]!.kind).toBe('text')
    if (coalesced[1]!.kind === 'text') {
      expect(coalesced[1]!.text).toBe('这是最终整理好的回答。')
    }
  })

  it('folds gates into the process item and keeps only final text outside', () => {
    const gateItem: AssistantDisplayTimelineItem = {
      kind: 'gate',
      key: 'g1',
      data: {
        request: {
          id: '1',
          sessionId: 's1',
          vaultName: 'v',
          title: '保存 Skill',
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
      {
        kind: 'tools',
        key: 't1',
        invocations: [],
        completedTools: [{ name: 'skill_save', durationMs: 100 }]
      },
      gateItem,
      { kind: 'text', key: 'txt1', text: '保存成功！' }
    ]

    const coalesced = coalesceTimelineItemsForDisplay(items)
    expect(coalesced).toHaveLength(2)
    expect(coalesced[0]!.kind).toBe('process')
    if (coalesced[0]!.kind === 'process') {
      expect(coalesced[0]!.gateItems).toHaveLength(1)
      expect(coalesced[0]!.steps.map((s) => s.kind)).toEqual(['reasoning', 'tools', 'gate'])
    }
    expect(coalesced[1]!.kind).toBe('text')
  })

  it('keeps visible reply text outside process when followed by trailing tools or reasoning without new text', () => {
    const items: AssistantDisplayTimelineItem[] = [
      { kind: 'reasoning', key: 'r1', text: '先思考回复内容' },
      { kind: 'text', key: 'txt1', text: '已经回复给用户的一半正文内容' },
      {
        kind: 'tools',
        key: 't1',
        invocations: [],
        completedTools: [{ name: 'memory_store', durationMs: 80 }]
      },
      { kind: 'reasoning', key: 'r2', text: '工具执行后续轮思考但未再输出正文' }
    ]

    const coalesced = coalesceTimelineItemsForDisplay(items)
    expect(coalesced).toHaveLength(2)
    expect(coalesced[0]!.kind).toBe('process')
    if (coalesced[0]!.kind === 'process') {
      expect(coalesced[0]!.hasSubsequentText).toBe(true)
      expect(coalesced[0]!.textItems).toHaveLength(0)
      expect(coalesced[0]!.reasoningItems).toHaveLength(2)
      expect(coalesced[0]!.toolsItems).toHaveLength(1)
    }
    expect(coalesced[1]!.kind).toBe('text')
    if (coalesced[1]!.kind === 'text') {
      expect(coalesced[1]!.text).toBe('已经回复给用户的一半正文内容')
    }
  })

  it('should keep reply segments after the last tool outside process even when reasoning appears between them', () => {
    const items: AssistantDisplayTimelineItem[] = [
      { kind: 'reasoning', key: 'r1', text: '先查图谱' },
      {
        kind: 'tools',
        key: 't1',
        invocations: [],
        completedTools: [{ name: 'companion_ask', durationMs: 80900 }]
      },
      { kind: 'reasoning', key: 'r2', text: '用户选了先不补，整理测试结论' },
      {
        kind: 'text',
        key: 'txt1',
        text: '好，那就先让它空着。反正测试的目的已经达到了：数据库读得到，节点建得进。'
      },
      { kind: 'reasoning', key: 'r3', text: '调用 emoji_send 后的续轮思考' },
      {
        kind: 'text',
        key: 'txt2',
        text: '对了，上一条里写的“535 验证”是我手滑，本来想写的是“写入”。'
      }
    ]

    const coalesced = coalesceTimelineItemsForDisplay(items)
    expect(coalesced).toHaveLength(3)
    expect(coalesced[0]!.kind).toBe('process')
    if (coalesced[0]!.kind === 'process') {
      expect(coalesced[0]!.hasSubsequentText).toBe(true)
      expect(coalesced[0]!.textItems).toHaveLength(0)
      expect(coalesced[0]!.reasoningItems).toHaveLength(3)
      expect(coalesced[0]!.toolsItems).toHaveLength(1)
    }
    expect(coalesced[1]!.kind).toBe('text')
    if (coalesced[1]!.kind === 'text') {
      expect(coalesced[1]!.text).toContain('好，那就先让它空着')
    }
    expect(coalesced[2]!.kind).toBe('text')
    if (coalesced[2]!.kind === 'text') {
      expect(coalesced[2]!.text).toContain('本来想写的是“写入”')
    }
  })

  it('should keep substantial structured report before companion_ask outside process while folding short commentary before normal tools', () => {
    const structuredReport = [
      '测完了，结论有点好笑：库是通的，但里面几乎什么都没有。',
      '一、日记关系图（生命图谱）——能查，但是空的',
      '- 查「武志红」：直接回我“未找到”。',
      '- 查「深度关系」的网络：返回了 5 个节点，它们之间当前一条边都没有。',
      '二、笔记本图谱——还是被拒',
      '要不要我把这座孤岛连起来？'
    ].join('\n')

    const items: AssistantDisplayTimelineItem[] = [
      { kind: 'reasoning', key: 'r1', text: '先查图数据库' },
      {
        kind: 'tools',
        key: 't1',
        invocations: [],
        completedTools: [{ name: 'graph_search', durationMs: 36 }]
      },
      { kind: 'text', key: 'txt1', text: structuredReport },
      {
        kind: 'tools',
        key: 't2',
        invocations: [],
        completedTools: [{ name: 'companion_ask', durationMs: 80900 }]
      },
      { kind: 'reasoning', key: 'r2', text: '收到回答' },
      { kind: 'text', key: 'txt2', text: '好，那就先让它空着。' }
    ]

    const coalesced = coalesceTimelineItemsForDisplay(items)
    expect(coalesced).toHaveLength(3)
    expect(coalesced[0]!.kind).toBe('process')
    if (coalesced[0]!.kind === 'process') {
      expect(coalesced[0]!.textItems).toHaveLength(0)
    }
    expect(coalesced[1]!.kind).toBe('text')
    if (coalesced[1]!.kind === 'text') {
      expect(coalesced[1]!.text).toContain('一、日记关系图')
    }
    expect(coalesced[2]!.kind).toBe('text')
    if (coalesced[2]!.kind === 'text') {
      expect(coalesced[2]!.text).toBe('好，那就先让它空着。')
    }
  })

  it('should keep all intermediate commentary inside process while streaming subsequent tools and reasoning', () => {
    const items: AssistantDisplayTimelineItem[] = [
      { kind: 'reasoning', key: 'r1', text: '先查第一轮图谱' },
      {
        kind: 'tools',
        key: 't1',
        invocations: [],
        completedTools: [{ name: 'recall_relations', durationMs: 28 }]
      },
      {
        kind: 'text',
        key: 'txt1',
        text: '关系图里确实有东西，并不是空的。我把实体和关系都逐一查过，再做汇总。'
      },
      {
        kind: 'tools',
        key: 't2',
        invocations: [],
        completedTools: [{ name: 'recall_relations', durationMs: 53 }]
      },
      {
        kind: 'text',
        key: 'txt2',
        text: '关系图比预想的大很多。「白守用户」这个中心节点自己就挂着 36 条边，单次查询最多只返回 20 条；我再补查两轮，把剩下的边也查出来。'
      },
      {
        kind: 'tools',
        key: 't3',
        invocations: [],
        completedTools: [{ name: 'recall_relations', durationMs: 75 }]
      },
      {
        kind: 'reasoning',
        key: 'r2',
        text: '正在整理完整节点与边的汇报结构…'
      }
    ]

    const streamingCoalesced = coalesceTimelineItemsForDisplay(items, { isStreaming: true })
    expect(streamingCoalesced).toHaveLength(1)
    expect(streamingCoalesced[0]!.kind).toBe('process')
    if (streamingCoalesced[0]!.kind === 'process') {
      expect(streamingCoalesced[0]!.hasSubsequentText).toBe(false)
      expect(streamingCoalesced[0]!.textItems).toHaveLength(2)
      expect(streamingCoalesced[0]!.steps.map((s) => s.key)).toEqual([
        'r1',
        't1',
        'txt1',
        't2',
        'txt2',
        't3',
        'r2'
      ])
    }

    const settledCoalesced = coalesceTimelineItemsForDisplay(items, { isStreaming: false })
    expect(settledCoalesced).toHaveLength(2)
    expect(settledCoalesced[0]!.kind).toBe('process')
    if (settledCoalesced[0]!.kind === 'process') {
      expect(settledCoalesced[0]!.hasSubsequentText).toBe(true)
      expect(settledCoalesced[0]!.textItems).toHaveLength(1)
      expect(settledCoalesced[0]!.textItems[0]!.key).toBe('txt1')
    }
    expect(settledCoalesced[1]!.kind).toBe('text')
    if (settledCoalesced[1]!.kind === 'text') {
      expect(settledCoalesced[1]!.key).toBe('txt2')
    }
  })
})
