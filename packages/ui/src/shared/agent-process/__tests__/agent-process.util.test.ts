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
})
