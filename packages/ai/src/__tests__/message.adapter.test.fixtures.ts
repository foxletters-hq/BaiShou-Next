import type { MessageWithParts } from '../agent/message.adapter'

export function makeToolPart(overrides: Record<string, unknown> = {}) {
  return {
    id: 'part-1',
    messageId: 'msg-1',
    sessionId: 'sess-1',
    type: 'tool' as const,
    data: {
      callId: 'call_00_test123',
      name: 'web_search',
      arguments: JSON.stringify({ queries: ['test'] }),
      result: '搜索结果内容',
      status: 'completed',
      ...overrides
    }
  }
}

export function makeTextPart(text: string, isReasoning = false) {
  return {
    id: 'part-text',
    messageId: 'msg-1',
    sessionId: 'sess-1',
    type: 'text' as const,
    data: { text, isReasoning }
  }
}

export function makeAssistantMsg(
  parts: MessageWithParts['parts'],
  overrides: Partial<MessageWithParts> = {}
) {
  return {
    id: 'msg-1',
    sessionId: 'sess-1',
    role: 'assistant' as const,
    isSummary: false,
    orderIndex: 1,
    createdAt: new Date(),
    parts,
    ...overrides
  }
}

export function makeUserMsg(text: string) {
  return {
    id: 'msg-user',
    sessionId: 'sess-1',
    role: 'user' as const,
    isSummary: false,
    orderIndex: 0,
    createdAt: new Date(),
    parts: [
      {
        id: 'part-user',
        messageId: 'msg-user',
        sessionId: 'sess-1',
        type: 'text' as const,
        data: { text }
      }
    ]
  }
}
