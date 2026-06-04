import { describe, it, expect, vi } from 'vitest'
import { ContextAtMessageService } from '../agent/context-at-message.service'
import { formatModelMessagesForDisplay } from '../agent/model-message-display.formatter'
import type { MessageWithParts } from '../agent/message.adapter'

function makeMsg(
  role: string,
  orderIndex: number,
  parts: MessageWithParts['parts'] = []
): MessageWithParts {
  return {
    id: `m${orderIndex}`,
    sessionId: 'session_1',
    role,
    isSummary: false,
    orderIndex,
    createdAt: new Date(),
    parts
  } as MessageWithParts
}

describe('ContextAtMessageService.resolveUpToOrderIndex', () => {
  const messages = [
    makeMsg('user', 0),
    makeMsg('assistant', 1),
    makeMsg('user', 2),
    makeMsg('assistant', 3)
  ]

  it('includes the user message itself for user role', () => {
    expect(ContextAtMessageService.resolveUpToOrderIndex('user', 2, messages)).toBe(2)
  })

  it('includes the triggering user message for assistant role', () => {
    expect(ContextAtMessageService.resolveUpToOrderIndex('assistant', 3, messages)).toBe(2)
  })
})

describe('ContextAtMessageService.resolveCompactionMeta', () => {
  it('uses tailStartMessageId for cutoff order (compression block ends before retain)', () => {
    const messages = [
      { ...makeMsg('user', 1), id: 'u1' },
      { ...makeMsg('assistant', 2), id: 'a1' },
      { ...makeMsg('user', 3), id: 'u2' },
      { ...makeMsg('assistant', 4), id: 'a2' }
    ]

    const meta = ContextAtMessageService.resolveCompactionMeta(messages, {
      id: 1,
      summaryText: 'sum',
      coveredUpToMessageId: 'a1',
      tailStartMessageId: 'u2'
    })

    expect(meta.compactionCutoffOrderIndex).toBe(2)
    expect(meta.compressionSummary).toBe('sum')
  })
})

describe('formatModelMessagesForDisplay', () => {
  it('merges tool-call and tool-result into one card', () => {
    const formatted = formatModelMessagesForDisplay([
      { role: 'user', content: 'hello' },
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: '1', toolName: 'web_search', args: { q: 'news' } }
        ]
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: '1',
            toolName: 'web_search',
            output: { type: 'text', value: 'result text' }
          }
        ]
      }
    ] as any)

    expect(formatted).toHaveLength(2)
    expect(formatted[1]).toMatchObject({
      role: 'assistant',
      label: '工具调用'
    })
    expect(formatted[1]?.content).toContain('### web_search')
    expect(formatted[1]?.content).toContain('```json')
    expect(formatted[1]?.content).toContain('### 结果')
    expect(formatted[1]?.content).toContain('result text')
  })

  it('shows reasoning before output even when stream order was text-first', () => {
    const formatted = formatModelMessagesForDisplay([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'final answer' },
          { type: 'reasoning', text: 'internal thought' }
        ]
      }
    ] as any)

    const assistantLabels = formatted.filter((m) => m.role === 'assistant').map((m) => m.label)
    expect(assistantLabels).toEqual(['AI 思考', 'AI 输出'])
  })
})

describe('ContextAtMessageService.getContextAtMessage', () => {
  it('returns reconstructed messages up to the selected user message', async () => {
    const messages: MessageWithParts[] = [
      makeMsg('user', 0, [
        { id: 'p0', messageId: 'm0', sessionId: 'session_1', type: 'text', data: { text: 'hi' } }
      ]),
      makeMsg('assistant', 1, [
        {
          id: 'p1',
          messageId: 'm1',
          sessionId: 'session_1',
          type: 'text',
          data: { text: 'hello back' }
        }
      ]),
      makeMsg('user', 2, [
        { id: 'p2', messageId: 'm2', sessionId: 'session_1', type: 'text', data: { text: 'again' } }
      ])
    ]

    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue(messages)
    }
    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValue(null)
    }

    const result = await ContextAtMessageService.getContextAtMessage(
      'session_1',
      'm2',
      sessionRepo as any,
      snapshotRepo as any,
      { recentCount: 0, systemPrompt: 'test prompt' }
    )

    expect(result.systemPrompt).toBe('test prompt')
    expect(result.viewModel.systemPrompt).toBe('test prompt')
    expect(result.viewModel.flatEntries.some((e) => e.kind === 'system-prompt')).toBe(true)
    expect(result.messages.map((m) => m.role)).toContain('user')
  })
})
