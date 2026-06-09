import { describe, it, expect } from 'vitest'
import {
  buildCallChainViewModel,
  buildPostCompactionDisplayHistory,
  groupChainIntoRounds,
  splitChainForCallChainView,
  COMPACTION_SUMMARY_PREFIX
} from '../agent/call-chain-view-model.builder'
import { formatMessageWithPartsForChain } from '../agent/model-message-display.formatter'
import type { MessageWithParts } from '../agent/message.adapter'

describe('groupChainIntoRounds', () => {
  it('keeps user text and attachments in the same round', () => {
    const msg = {
      id: 'm1',
      sessionId: 's1',
      role: 'user',
      isSummary: false,
      orderIndex: 1,
      createdAt: new Date(),
      parts: [
        { id: 'p1', messageId: 'm1', sessionId: 's1', type: 'text', data: { text: 'hello' } },
        {
          id: 'p2',
          messageId: 'm1',
          sessionId: 's1',
          type: 'attachment',
          data: { name: 'photo.png', type: 'image', url: '/tmp/photo.png' }
        }
      ]
    } as MessageWithParts

    const rounds = groupChainIntoRounds(formatMessageWithPartsForChain(msg))
    expect(rounds).toHaveLength(1)
    expect(rounds[0]?.items).toHaveLength(1)
    expect(rounds[0]?.items[0]?.content).toBe('hello')
    expect(rounds[0]?.items[0]?.attachments).toMatchObject([
      { fileName: 'photo.png', isImage: true }
    ])
  })

  it('splits by user messages into rounds', () => {
    const rounds = groupChainIntoRounds([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b', label: 'AI 输出' },
      { role: 'user', content: 'c' },
      { role: 'assistant', content: 'd', label: 'AI 思考' }
    ])

    expect(rounds).toHaveLength(2)
    expect(rounds[0]?.items.map((i) => i.content)).toEqual(['a', 'b'])
    expect(rounds[1]?.items.map((i) => i.content)).toEqual(['c', 'd'])
  })

  it('skips compaction summary when grouping rounds', () => {
    const rounds = groupChainIntoRounds([
      {
        role: 'system',
        content: `${COMPACTION_SUMMARY_PREFIX}：\nolder context`
      },
      { role: 'user', content: 'after compress' },
      { role: 'assistant', content: 'reply', label: 'AI 输出' }
    ])
    expect(rounds).toHaveLength(1)
    expect(rounds[0]?.roundIndex).toBe(1)
  })
})

describe('splitChainForCallChainView', () => {
  it('extracts compaction and post-compaction history', () => {
    const { historyAfterCompaction, inlineCompactionSummary } = splitChainForCallChainView([
      { role: 'system', content: 'sys', label: '系统提示词' },
      { role: 'system', content: `${COMPACTION_SUMMARY_PREFIX}：\n摘要内容` },
      { role: 'user', content: 'u1' }
    ])
    expect(inlineCompactionSummary).toBe('摘要内容')
    expect(historyAfterCompaction).toHaveLength(1)
    expect(historyAfterCompaction[0]?.content).toBe('u1')
  })
})

describe('formatMessageWithPartsForChain order', () => {
  it('puts reasoning before output and tools after', () => {
    const msg = {
      id: 'm1',
      sessionId: 's1',
      role: 'assistant',
      isSummary: false,
      orderIndex: 1,
      createdAt: new Date(),
      parts: [
        {
          id: 'p1',
          messageId: 'm1',
          sessionId: 's1',
          type: 'text',
          data: { text: 'answer text' }
        },
        {
          id: 'p2',
          messageId: 'm1',
          sessionId: 's1',
          type: 'text',
          data: { text: 'think text', isReasoning: true }
        },
        {
          id: 'p3',
          messageId: 'm1',
          sessionId: 's1',
          type: 'tool',
          data: { name: 'message_search', arguments: {}, result: 'ok' }
        }
      ]
    } as MessageWithParts

    const labels = formatMessageWithPartsForChain(msg).map((i) => i.label)
    expect(labels).toEqual(['AI 思考', '工具调用', 'AI 输出'])
  })
})

describe('buildCallChainViewModel', () => {
  it('includes system prompt entry and next request estimate', () => {
    const vm = buildCallChainViewModel({
      chain: [
        { role: 'system', content: 'sys', label: '系统提示词' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello', label: 'AI 输出' }
      ],
      systemPrompt: 'current system prompt with tools',
      recentCount: 30,
      target: {
        role: 'assistant',
        orderIndex: 2,
        inputTokens: 100,
        outputTokens: 50,
        costMicros: 1000
      },
      allMessages: [
        { role: 'user', orderIndex: 1 },
        { role: 'assistant', orderIndex: 2, inputTokens: 100, outputTokens: 50, costMicros: 1000 }
      ]
    })

    expect(vm.flatEntries.some((e) => e.kind === 'system-prompt')).toBe(true)
    expect(vm.nextRequest.estimatedInputTokens).toBeGreaterThan(0)
    expect(vm.roundUsage?.inputTokens).toBe(100)
    expect(vm.rounds).toHaveLength(1)
  })

  it('places compression summary after system prompt and renumbers rounds', () => {
    const windowMessages = [
      {
        id: 'snap',
        sessionId: 's1',
        role: 'system',
        isSummary: true,
        orderIndex: -1,
        createdAt: new Date(),
        parts: [
          {
            id: 'p0',
            messageId: 'snap',
            sessionId: 's1',
            type: 'text',
            data: { text: `${COMPACTION_SUMMARY_PREFIX}：\n历史摘要` }
          }
        ]
      },
      {
        id: 'm1',
        sessionId: 's1',
        role: 'user',
        isSummary: false,
        orderIndex: 1,
        createdAt: new Date(),
        parts: [
          { id: 'p1', messageId: 'm1', sessionId: 's1', type: 'text', data: { text: 'old user' } }
        ]
      },
      {
        id: 'm2',
        sessionId: 's1',
        role: 'assistant',
        isSummary: false,
        orderIndex: 2,
        createdAt: new Date(),
        parts: [
          { id: 'p2', messageId: 'm2', sessionId: 's1', type: 'text', data: { text: 'old ai' } }
        ]
      },
      {
        id: 'm3',
        sessionId: 's1',
        role: 'user',
        isSummary: false,
        orderIndex: 3,
        createdAt: new Date(),
        parts: [{ id: 'p3', messageId: 'm3', sessionId: 's1', type: 'text', data: { text: 'u1' } }]
      },
      {
        id: 'm4',
        sessionId: 's1',
        role: 'assistant',
        isSummary: false,
        orderIndex: 4,
        createdAt: new Date(),
        parts: [{ id: 'p4', messageId: 'm4', sessionId: 's1', type: 'text', data: { text: 'a1' } }]
      },
      {
        id: 'm5',
        sessionId: 's1',
        role: 'user',
        isSummary: false,
        orderIndex: 5,
        createdAt: new Date(),
        parts: [{ id: 'p5', messageId: 'm5', sessionId: 's1', type: 'text', data: { text: 'u2' } }]
      },
      {
        id: 'm6',
        sessionId: 's1',
        role: 'assistant',
        isSummary: false,
        orderIndex: 6,
        createdAt: new Date(),
        parts: [{ id: 'p6', messageId: 'm6', sessionId: 's1', type: 'text', data: { text: 'a2' } }]
      }
    ] as MessageWithParts[]

    const vm = buildCallChainViewModel({
      chain: [
        { role: 'system', content: `${COMPACTION_SUMMARY_PREFIX}：\n历史摘要` },
        { role: 'user', content: 'u1' },
        { role: 'assistant', content: 'a1', label: 'AI 输出' },
        { role: 'user', content: 'u2' },
        { role: 'assistant', content: 'a2', label: 'AI 输出' }
      ],
      systemPrompt: 'persona',
      recentCount: 30,
      target: { role: 'assistant', orderIndex: 6 },
      allMessages: [
        { role: 'user', orderIndex: 1 },
        { role: 'assistant', orderIndex: 2 },
        { role: 'user', orderIndex: 3 },
        { role: 'assistant', orderIndex: 4 },
        { role: 'user', orderIndex: 5 },
        { role: 'assistant', orderIndex: 6 }
      ],
      compressionSummary: '历史摘要',
      compactionCutoffOrderIndex: 2,
      windowMessages
    })

    const kinds = vm.flatEntries.map((e) => e.kind)
    expect(kinds[0]).toBe('system-prompt')
    expect(kinds[1]).toBe('compression-summary')
    expect(kinds[2]).toBe('round-header')
    expect(vm.rounds).toHaveLength(2)
    expect(vm.rounds[0]?.roundIndex).toBe(1)
    expect(vm.rounds[0]?.items[0]?.content).toBe('u1')
    expect(vm.rounds[1]?.roundIndex).toBe(2)
    expect(vm.activeRoundIndex).toBe(2)
  })

  it('appends assistant reply items when target is assistant with window messages', () => {
    const windowMessages = [
      {
        id: 'm1',
        sessionId: 's1',
        role: 'user',
        isSummary: false,
        orderIndex: 1,
        createdAt: new Date(),
        parts: [
          { id: 'p1', messageId: 'm1', sessionId: 's1', type: 'text', data: { text: '你好' } }
        ]
      }
    ] as MessageWithParts[]

    const assistantTarget = {
      id: 'm2',
      sessionId: 's1',
      role: 'assistant',
      isSummary: false,
      orderIndex: 2,
      createdAt: new Date(),
      parts: [
        {
          id: 'p2',
          messageId: 'm2',
          sessionId: 's1',
          type: 'text',
          data: { text: 'think', isReasoning: true }
        },
        {
          id: 'p3',
          messageId: 'm2',
          sessionId: 's1',
          type: 'tool',
          data: { name: 'message_search', arguments: {}, result: 'ok' }
        },
        {
          id: 'p4',
          messageId: 'm2',
          sessionId: 's1',
          type: 'text',
          data: { text: '你好呀' }
        }
      ]
    } as MessageWithParts

    const vm = buildCallChainViewModel({
      chain: [
        { role: 'user', content: '你好', label: '用户' },
        { role: 'assistant', content: 'think', label: 'AI 思考' },
        { role: 'assistant', content: 'tool', label: '工具调用' },
        { role: 'assistant', content: '你好呀', label: 'AI 输出' }
      ],
      systemPrompt: 'sys',
      recentCount: 30,
      target: { role: 'assistant', orderIndex: 2 },
      allMessages: [
        { role: 'user', orderIndex: 1 },
        { role: 'assistant', orderIndex: 2 }
      ],
      windowMessages,
      targetMessage: assistantTarget,
      allMessagesWithParts: [windowMessages[0]!, assistantTarget]
    })

    const messageLabels = vm.flatEntries
      .filter((e) => e.kind === 'message')
      .map((e) => (e.kind === 'message' ? e.item?.label : undefined))

    expect(messageLabels).toEqual(['用户', 'AI 思考', '工具调用', 'AI 输出'])
    expect(vm.rounds[0]?.items).toHaveLength(4)
  })
})

describe('buildPostCompactionDisplayHistory', () => {
  it('excludes messages at or before compaction cutoff', () => {
    const items = buildPostCompactionDisplayHistory(
      [
        {
          id: 'm1',
          sessionId: 's1',
          role: 'user',
          isSummary: false,
          orderIndex: 1,
          createdAt: new Date(),
          parts: [
            { id: 'p1', messageId: 'm1', sessionId: 's1', type: 'text', data: { text: 'before' } }
          ]
        },
        {
          id: 'm2',
          sessionId: 's1',
          role: 'user',
          isSummary: false,
          orderIndex: 3,
          createdAt: new Date(),
          parts: [
            { id: 'p2', messageId: 'm2', sessionId: 's1', type: 'text', data: { text: 'after' } }
          ]
        }
      ] as MessageWithParts[],
      2
    )
    expect(items.map((i) => i.content)).toEqual(['after'])
  })
})
