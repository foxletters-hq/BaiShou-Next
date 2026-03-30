import { describe, it, expect } from 'vitest';
import { buildContextWindow } from '../session/context-window';

describe('ContextWindow', () => {
  const makeMessages = (roles: string[]) =>
    roles.map((role, i) => ({
      role,
      content: `msg_${i}_${role}`,
    }));

  it('should return all messages when count is within window size', () => {
    const messages = makeMessages(['user', 'assistant', 'user', 'assistant']);
    const result = buildContextWindow({ messages, config: { recentCount: 10 } });
    expect(result).toHaveLength(4);
  });

  it('should truncate to recentCount when messages exceed window', () => {
    const messages = makeMessages([
      'user', 'assistant', 'user', 'assistant',
      'user', 'assistant', 'user', 'assistant',
    ]);
    const result = buildContextWindow({ messages, config: { recentCount: 4 } });
    expect(result).toHaveLength(4);
    // 应保留最后 4 条
    expect(result[0]!.content).toContain('msg_4');
  });

  it('should not truncate when recentCount is 0 (unlimited)', () => {
    const messages = makeMessages(['user', 'assistant', 'user', 'assistant']);
    const result = buildContextWindow({ messages, config: { recentCount: 0 } });
    expect(result).toHaveLength(4);
  });

  it('should prepend summary and preserve it when truncating', () => {
    const messages = makeMessages([
      'user', 'assistant', 'user', 'assistant',
      'user', 'assistant',
    ]);
    const result = buildContextWindow({
      messages,
      config: { recentCount: 3 },
      snapshot: {
        id: 's1',
        sessionId: 'session_1',
        summaryText: '之前的对话摘要',
        coveredUpToMessageId: 'msg_0',
        messageCount: 5,
        createdAt: new Date(),
      },
    });

    // 摘要应在头部
    expect(result[0]!.role).toBe('system');
    expect(result[0]!.content).toContain('对话摘要');
  });

  it('should not split tool call pairs when truncating', () => {
    const messages = makeMessages([
      'user', 'assistant', 'tool', 'tool',
      'user', 'assistant',
    ]);
    const result = buildContextWindow({ messages, config: { recentCount: 3 } });

    // 第一条不应该是 tool
    expect(result[0]!.role).not.toBe('tool');
  });

  it('should handle empty messages', () => {
    const result = buildContextWindow({ messages: [] });
    expect(result).toHaveLength(0);
  });
});
