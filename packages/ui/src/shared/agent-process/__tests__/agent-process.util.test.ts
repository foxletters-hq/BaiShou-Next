import { describe, expect, it } from 'vitest'
import { coalesceTimelineItemsForDisplay, formatAgentProcessTitle } from '../agent-process.util'
import type { AssistantDisplayTimelineItem } from '@baishou/shared'

describe('formatAgentProcessTitle', () => {
  it('formats active tool title during streaming before text', () => {
    const title = formatAgentProcessTitle({
      hasReasoning: true,
      completedToolsCount: 1,
      isStreaming: true,
      hasAnswerText: false,
      activeToolName: 'diary_search'
    })
    expect(title).toBe('正在执行：diary_search…')
  })

  it('localizes the active tool name via i18n', () => {
    const t = (key: string, fallback?: string) =>
      key === 'agent.tools.diary_search' ? '日记搜索' : (fallback ?? key)

    const title = formatAgentProcessTitle({
      hasReasoning: true,
      completedToolsCount: 0,
      isStreaming: true,
      hasAnswerText: false,
      activeToolName: 'diary_search',
      t
    })
    expect(title).toBe('正在执行：日记搜索…')
  })

  it('keeps an already localized active tool display name unchanged', () => {
    const t = (key: string, fallback?: string) => fallback ?? key

    const title = formatAgentProcessTitle({
      hasReasoning: true,
      completedToolsCount: 0,
      isStreaming: true,
      hasAnswerText: false,
      activeToolName: '网络搜索 (Exa)',
      t
    })
    expect(title).toBe('正在执行：网络搜索 (Exa)…')
  })

  it('formats active thinking during streaming before text', () => {
    const title = formatAgentProcessTitle({
      hasReasoning: true,
      completedToolsCount: 0,
      isStreaming: true,
      hasAnswerText: false,
      isThinkLoading: true
    })
    expect(title).toBe('深度思考中…')
  })

  it('formats thought and tools summary without duration when answered', () => {
    const title = formatAgentProcessTitle({
      hasReasoning: true,
      completedToolsCount: 3,
      totalDurationMs: 2400,
      isStreaming: false,
      hasAnswerText: true
    })
    expect(title).toBe('思考完成，完成3项操作')
  })

  it('formats tools only summary when answered', () => {
    const title = formatAgentProcessTitle({
      hasReasoning: false,
      completedToolsCount: 2,
      totalDurationMs: 850,
      isStreaming: false,
      hasAnswerText: true
    })
    expect(title).toBe('完成2项操作')
  })

  it('formats thinking only summary when answered', () => {
    const title = formatAgentProcessTitle({
      hasReasoning: true,
      completedToolsCount: 0,
      isStreaming: false,
      hasAnswerText: true
    })
    expect(title).toBe('思考完成')
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
})
