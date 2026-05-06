import { describe, it, expect } from 'vitest';
import { MessageAdapter, MessageWithParts } from '../agent/message.adapter';

function makeToolPart(overrides: Record<string, any> = {}) {
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
      ...overrides,
    },
  };
}

function makeTextPart(text: string, isReasoning = false) {
  return {
    id: 'part-text',
    messageId: 'msg-1',
    sessionId: 'sess-1',
    type: 'text' as const,
    data: { text, isReasoning },
  };
}

function makeAssistantMsg(parts: MessageWithParts['parts'], overrides: Partial<MessageWithParts> = {}) {
  return {
    id: 'msg-1',
    sessionId: 'sess-1',
    role: 'assistant' as const,
    isSummary: false,
    orderIndex: 1,
    createdAt: new Date(),
    parts,
    ...overrides,
  };
}

function makeUserMsg(text: string) {
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
        data: { text },
      },
    ],
  };
}

describe('MessageAdapter.toVercelMessages', () => {
  describe('助理消息中的工具调用 (tool parts in assistant messages)', () => {
    it('should generate tool-call in assistant and tool-result in tool message when tool part has result', () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索新闻'),
        makeAssistantMsg([makeTextPart('正在搜索...'), makeToolPart()]),
      ];

      const result = MessageAdapter.toVercelMessages(dbMessages);

      expect(result).toHaveLength(3);

      // 用户消息
      expect(result[0]?.role).toBe('user');

      // 助理消息应包含 tool-call
      const assistantMsg = result[1];
      expect(assistantMsg?.role).toBe('assistant');
      expect(assistantMsg?.content).toBeInstanceOf(Array);
      const contentArr = assistantMsg.content as any[];
      const toolCalls = contentArr.filter((p: any) => p.type === 'tool-call');
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].toolCallId).toBe('call_00_test123');
      expect(toolCalls[0].toolName).toBe('web_search');

      // tool 消息应包含 tool-result
      const toolMsg = result[2];
      expect(toolMsg?.role).toBe('tool');
      expect(toolMsg?.content).toBeInstanceOf(Array);
      const toolResults = (toolMsg.content as any[]).filter((p: any) => p.type === 'tool-result');
      expect(toolResults).toHaveLength(1);
      expect(toolResults[0].toolCallId).toBe('call_00_test123');
      expect(toolResults[0].toolName).toBe('web_search');
      expect(toolResults[0].result).toBe('搜索结果内容');
    });

    it('should generate tool-result with fallback error when tool part has no result', () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索新闻'),
        makeAssistantMsg([makeToolPart({ result: undefined, status: 'failed' })]),
      ];

      const result = MessageAdapter.toVercelMessages(dbMessages);

      expect(result).toHaveLength(3);
      const toolMsg = result[2];
      const toolResults = (toolMsg?.content as any[]).filter((p: any) => p.type === 'tool-result');
      expect(toolResults).toHaveLength(1);
      expect(toolResults[0].result).toBe('[工具执行失败: web_search]');
    });

    it('should handle multiple tool parts in one assistant message', () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索并读取'),
        makeAssistantMsg([
          makeTextPart('让我来搜索'),
          makeToolPart({ callId: 'call_01', name: 'web_search', arguments: '{}', result: '结果1', status: 'completed' }),
          makeToolPart({ callId: 'call_02', name: 'url_read', arguments: '{}', result: '结果2', status: 'completed' }),
        ]),
      ];

      const result = MessageAdapter.toVercelMessages(dbMessages);

      expect(result).toHaveLength(3);

      const assistantMsg = result[1];
      const contentArr = assistantMsg.content as any[];
      const toolCalls = contentArr.filter((p: any) => p.type === 'tool-call');
      expect(toolCalls).toHaveLength(2);

      const toolMsg = result[2];
      const toolResults = (toolMsg.content as any[]).filter((p: any) => p.type === 'tool-result');
      expect(toolResults).toHaveLength(2);
      expect(toolResults[0].result).toBe('结果1');
      expect(toolResults[1].result).toBe('结果2');
    });

    it('should NOT generate a tool message when assistant has no tool parts', () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('你好'),
        makeAssistantMsg([makeTextPart('你好！有什么可以帮助你的？')]),
      ];

      const result = MessageAdapter.toVercelMessages(dbMessages);

      expect(result).toHaveLength(2);
      expect(result[0]?.role).toBe('user');
      expect(result[1]?.role).toBe('assistant');
    });

    it('should place tool messages immediately after their corresponding assistant message', () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('第一次'),
        makeAssistantMsg([makeToolPart({ callId: 'call_a', name: 'web_search', arguments: '{}', result: '结果A', status: 'completed' })]),
        makeUserMsg('第二次'),
        makeAssistantMsg([makeToolPart({ callId: 'call_b', name: 'url_read', arguments: '{}', result: '结果B', status: 'completed' })]),
      ];

      const result = MessageAdapter.toVercelMessages(dbMessages);

      // 期望顺序: user, assistant(call_a), tool(result_a), user, assistant(call_b), tool(result_b)
      expect(result).toHaveLength(6);
      expect(result[0]?.role).toBe('user');
      expect(result[1]?.role).toBe('assistant');
      expect((result[1].content as any[]).filter((p: any) => p.type === 'tool-call')[0].toolCallId).toBe('call_a');
      expect(result[2]?.role).toBe('tool');
      expect((result[2].content as any[])[0].toolCallId).toBe('call_a');
      expect(result[3]?.role).toBe('user');
      expect(result[4]?.role).toBe('assistant');
      expect((result[4].content as any[]).filter((p: any) => p.type === 'tool-call')[0].toolCallId).toBe('call_b');
      expect(result[5]?.role).toBe('tool');
      expect((result[5].content as any[])[0].toolCallId).toBe('call_b');
    });

    it('should correctly parse stringified arguments', () => {
      const args = { queries: ['最新 Flutter 特性', 'Flutter 迁移指南'] };
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索'),
        makeAssistantMsg([makeToolPart({ callId: 'call_c', name: 'web_search', arguments: JSON.stringify(args), result: '结果C', status: 'completed' })]),
      ];

      const result = MessageAdapter.toVercelMessages(dbMessages);

      const assistantMsg = result[1];
      const toolCall = (assistantMsg.content as any[]).find((p: any) => p.type === 'tool-call');
      expect(toolCall.args).toEqual(args);
    });

    it('should use empty object as args when arguments is not a string', () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索'),
        makeAssistantMsg([makeToolPart({ callId: 'call_d', name: 'web_search', arguments: null as any, result: '结果D', status: 'completed' })]),
      ];

      const result = MessageAdapter.toVercelMessages(dbMessages);

      const assistantMsg = result[1];
      const toolCall = (assistantMsg.content as any[]).find((p: any) => p.type === 'tool-call');
      expect(toolCall.args).toEqual({});
    });

    it('should handle reasoning parts alongside tool parts', () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索'),
        makeAssistantMsg([
          makeTextPart('思考过程', true),
          makeTextPart('执行搜索'),
          makeToolPart(),
        ]),
      ];

      const result = MessageAdapter.toVercelMessages(dbMessages);

      const assistantMsg = result[1];
      const contentArr = assistantMsg.content as any[];
      expect(contentArr).toHaveLength(3);
      expect(contentArr[0].type).toBe('reasoning');
      expect(contentArr[1].type).toBe('text');
      expect(contentArr[2].type).toBe('tool-call');

      const toolMsg = result[2];
      expect(toolMsg?.role).toBe('tool');
    });

    it('should still handle existing tool role messages from DB correctly', () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索'),
        {
          id: 'msg-tool-1',
          sessionId: 'sess-1',
          role: 'tool' as const,
          orderIndex: 1,
          createdAt: new Date(),
          parts: [
            {
              id: 'part-tool-1',
              messageId: 'msg-tool-1',
              sessionId: 'sess-1',
              type: 'tool' as const,
              data: {
                callId: 'call_existing',
                name: 'web_search',
                result: '已有结果',
                status: 'completed',
              },
            },
          ],
        },
      ];

      const result = MessageAdapter.toVercelMessages(dbMessages);

      expect(result).toHaveLength(2);
      expect(result[0]?.role).toBe('user');
      expect(result[1]?.role).toBe('tool');
      const toolResults = (result[1].content as any[]).filter((p: any) => p.type === 'tool-result');
      expect(toolResults).toHaveLength(1);
      expect(toolResults[0].result).toBe('已有结果');
    });

    it('should skip assistant messages with no parts', () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('你好'),
        makeAssistantMsg([]),
        makeUserMsg('你还在吗'),
        makeAssistantMsg([makeTextPart('我在')]),
      ];

      const result = MessageAdapter.toVercelMessages(dbMessages);

      expect(result).toHaveLength(3);
      expect(result[0]?.role).toBe('user');
      expect(result[1]?.role).toBe('user');
      expect(result[2]?.role).toBe('assistant');
    });

    it('should skip tool parts without callId or name', () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索'),
        makeAssistantMsg([
          makeTextPart('文本'),
          {
            id: 'part-invalid',
            messageId: 'msg-1',
            sessionId: 'sess-1',
            type: 'tool' as const,
            data: { result: '无ID的结果' },
          },
        ]),
      ];

      const result = MessageAdapter.toVercelMessages(dbMessages);

      expect(result).toHaveLength(2);
      const assistantMsg = result[1];
      const contentArr = assistantMsg.content as any[];
      const toolCalls = contentArr.filter((p: any) => p.type === 'tool-call');
      expect(toolCalls).toHaveLength(0);
      expect(contentArr).toHaveLength(1);
      expect(contentArr[0].type).toBe('text');
    });

    it('should pass Vercel SDK validation: tool-call count matches tool-result count', () => {
      const toolData = [
        { callId: 'call_1', name: 'web_search', arguments: '{}', result: 'r1', status: 'completed' },
        { callId: 'call_2', name: 'url_read', arguments: '{}', result: 'r2', status: 'completed' },
      ];

      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索'),
        makeAssistantMsg([
          makeTextPart('正在搜索...'),
          makeToolPart({ data: toolData[0] }),
          makeToolPart({ data: toolData[1] }),
        ]),
      ];

      const result = MessageAdapter.toVercelMessages(dbMessages);

      const assistantContent = result[1].content as any[];
      const toolCallCount = assistantContent.filter((p: any) => p.type === 'tool-call').length;

      const toolContent = result[2].content as any[];
      const toolResultCount = toolContent.filter((p: any) => p.type === 'tool-result').length;

      expect(toolCallCount).toBe(toolResultCount);
      expect(toolCallCount).toBe(2);
    });
  });
});
