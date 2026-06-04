import { describe, it, expect } from 'vitest'
import { ContextCallChainBuilder } from '../agent/context-call-chain.builder'
import { formatMessageWithPartsForChain } from '../agent/model-message-display.formatter'
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

describe('ContextCallChainBuilder', () => {
  it('builds full chain with system prompt, input context, and assistant output', () => {
    const allMessages = [
      makeMsg('user', 0),
      makeMsg('assistant', 1, [
        {
          id: 'p1',
          messageId: 'm1',
          sessionId: 'session_1',
          type: 'text',
          data: { text: 'hello back' }
        }
      ])
    ]

    const result = ContextCallChainBuilder.build({
      systemPrompt: 'You are helpful.',
      modelMessages: [{ role: 'user', content: 'hi' }],
      target: allMessages[1]!,
      allMessages
    })

    expect(result.chain[0]).toMatchObject({
      role: 'system',
      label: '系统提示词',
      content: 'You are helpful.'
    })
    expect(result.chain[1]).toMatchObject({ role: 'user', content: 'hi' })
    expect(result.chain[2]).toMatchObject({
      role: 'assistant',
      label: 'AI 输出',
      content: 'hello back'
    })
  })

  it('appends assistant response when target is user message', () => {
    const allMessages = [
      makeMsg('user', 0, [
        {
          id: 'p0',
          messageId: 'm0',
          sessionId: 'session_1',
          type: 'text',
          data: { text: 'question' }
        }
      ]),
      makeMsg('assistant', 1, [
        {
          id: 'p1',
          messageId: 'm1',
          sessionId: 'session_1',
          type: 'text',
          data: { text: 'answer' }
        }
      ])
    ]

    const result = ContextCallChainBuilder.build({
      systemPrompt: 'sys',
      modelMessages: [{ role: 'user', content: 'question' }],
      target: allMessages[0]!,
      allMessages
    })

    expect(result.chain.map((m) => m.label)).toEqual(['系统提示词', undefined, 'AI 输出'])
    expect(result.chain[2]?.content).toBe('answer')
  })

  it('merges tool call and result into one chain card from message parts', () => {
    const items = formatMessageWithPartsForChain(
      makeMsg('assistant', 1, [
        {
          id: 'p-tool',
          messageId: 'm1',
          sessionId: 'session_1',
          type: 'tool',
          data: {
            name: 'message_search',
            arguments: { query: '日记' },
            result: 'found 3 items'
          }
        }
      ])
    )

    expect(items).toHaveLength(1)
    expect(items[0]?.label).toBe('工具调用')
    expect(items[0]?.content).toContain('```json')
    expect(items[0]?.content).toContain('### 结果')
    expect(items[0]?.content).toContain('found 3 items')
  })
})
