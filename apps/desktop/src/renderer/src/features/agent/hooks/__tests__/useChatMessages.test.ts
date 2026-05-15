import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatMessages } from '../useChatMessages';

function setupWindowMock() {
  const mockRenderer = {
    invoke: vi.fn(),
    on: vi.fn(() => () => {}),
    removeAllListeners: vi.fn(),
  };

  const win = (globalThis as any).window || globalThis;
  win.electron = { ipcRenderer: mockRenderer };

  return { mockRenderer };
}

function teardownWindowMock() {
  const win = (globalThis as any).window;
  if (win) {
    delete win.electron;
  }
}

describe('useChatMessages', () => {
  let mockRenderer: ReturnType<typeof setupWindowMock>['mockRenderer'];

  beforeEach(() => {
    const setup = setupWindowMock();
    mockRenderer = setup.mockRenderer;
    mockRenderer.invoke.mockResolvedValue([]);
  });

  afterEach(() => {
    teardownWindowMock();
    vi.restoreAllMocks();
  });

  describe('addUserMessage', () => {
    it('should add a user message with the given real UUID to state', () => {
      const { result } = renderHook(() =>
        useChatMessages({ sessionId: 's1', isStreaming: false, streamingText: '', streamingReasoning: '' })
      );

      act(() => {
        result.current.addUserMessage('msg-uuid-1', '你好', [{ name: 'test.png' }]);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toMatchObject({
        id: 'msg-uuid-1',
        role: 'user',
        content: '你好',
      });
      expect(result.current.messages[0].attachments).toEqual([{ name: 'test.png' }]);
    });

    it('should not add duplicate when message with same ID already exists', () => {
      const { result } = renderHook(() =>
        useChatMessages({ sessionId: 's1', isStreaming: false, streamingText: '', streamingReasoning: '' })
      );

      act(() => { result.current.addUserMessage('msg-1', '第一次添加'); });
      expect(result.current.messages).toHaveLength(1);

      act(() => { result.current.addUserMessage('msg-1', '重复添加'); });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('第一次添加');
    });

    it('should allow adding multiple messages with different IDs', () => {
      const { result } = renderHook(() =>
        useChatMessages({ sessionId: 's1', isStreaming: false, streamingText: '', streamingReasoning: '' })
      );

      act(() => { result.current.addUserMessage('msg-a', 'A'); });
      act(() => { result.current.addUserMessage('msg-b', 'B'); });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].id).toBe('msg-a');
      expect(result.current.messages[1].id).toBe('msg-b');
    });
  });

  describe('optimisticRemove', () => {
    it('should remove an existing message by ID', () => {
      const { result } = renderHook(() =>
        useChatMessages({ sessionId: 's1', isStreaming: false, streamingText: '', streamingReasoning: '' })
      );

      act(() => { result.current.addUserMessage('msg-1', 'test'); });
      expect(result.current.messages).toHaveLength(1);

      act(() => { result.current.optimisticRemove('msg-1'); });
      expect(result.current.messages).toHaveLength(0);
    });

    it('should be a no-op for non-existent message ID', () => {
      const { result } = renderHook(() =>
        useChatMessages({ sessionId: 's1', isStreaming: false, streamingText: '', streamingReasoning: '' })
      );

      act(() => { result.current.addUserMessage('msg-1', 'test'); });
      act(() => { result.current.optimisticRemove('nonexistent'); });

      expect(result.current.messages).toHaveLength(1);
    });
  });

  describe('refreshMessages', () => {
    it('should fetch messages from IPC and replace state', async () => {
      const dbMessages = [
        { id: 'db-1', role: 'user', content: '历史消息', createdAt: new Date().toISOString() },
        { id: 'db-2', role: 'assistant', content: 'AI 回复', createdAt: new Date().toISOString() },
      ];
      mockRenderer.invoke.mockResolvedValue(dbMessages);

      const { result } = renderHook(() =>
        useChatMessages({ sessionId: 's1', isStreaming: false, streamingText: '', streamingReasoning: '' })
      );

      await act(async () => {
        await result.current.refreshMessages(2);
      });

      expect(mockRenderer.invoke).toHaveBeenCalledWith('agent:get-messages', 's1', 20, 0);
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].id).toBe('db-1');
    });

    it('should return false when IPC returns empty array', async () => {
      mockRenderer.invoke.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useChatMessages({ sessionId: 's1', isStreaming: false, streamingText: '', streamingReasoning: '' })
      );

      let success = true;
      await act(async () => {
        success = await result.current.refreshMessages(2);
      });

      expect(success).toBe(false);
    });

    it('should guard against overwrite when DB has fewer messages than state', async () => {
      // 先挂载让 Effect 1 完成（mock 返回空）
      mockRenderer.invoke.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useChatMessages({ sessionId: 's1', isStreaming: false, streamingText: '', streamingReasoning: '' })
      );

      // 等后台 loadMessages 重试跑完：先让 IPC 返回空，手动等待
      await new Promise(r => setTimeout(r, 1000));

      act(() => { result.current.addUserMessage('a', '1'); });
      act(() => { result.current.addUserMessage('b', '2'); });
      act(() => { result.current.addUserMessage('c', '3'); });
      expect(result.current.messages).toHaveLength(3);

      // 改为返回 1 条 DB 消息（少于 state 的 3 条），触发安全守卫
      mockRenderer.invoke.mockResolvedValue([
        { id: 'db-1', role: 'user', content: '仅一条', createdAt: new Date().toISOString() },
      ]);

      let success = true;
      await act(async () => {
        success = await result.current.refreshMessages(2);
      });

      expect(success).toBe(false);
      expect(result.current.messages).toHaveLength(3);
    }, 10000);

    it('should allow overwrite when DB count is sufficient', async () => {
      mockRenderer.invoke.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useChatMessages({ sessionId: 's1', isStreaming: false, streamingText: '', streamingReasoning: '' })
      );

      // 等后台 loadMessages 重试完成
      await new Promise(r => setTimeout(r, 1000));

      act(() => { result.current.addUserMessage('a', '1'); });
      act(() => { result.current.addUserMessage('b', '2'); });

      mockRenderer.invoke.mockResolvedValue([
        { id: 'db-a', role: 'user', content: 'A', createdAt: new Date().toISOString() },
        { id: 'db-b', role: 'assistant', content: 'B', createdAt: new Date().toISOString() },
      ]);

      await act(async () => {
        await result.current.refreshMessages(2);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].id).toBe('db-a');
    }, 10000);
  });

  describe('ref setters', () => {
    it('should accept setStreamSessionId and markOptimisticSession without errors', () => {
      const { result } = renderHook(() =>
        useChatMessages({ sessionId: 's1', isStreaming: false, streamingText: '', streamingReasoning: '' })
      );

      act(() => { result.current.setStreamSessionId('stream-s1'); });
      act(() => { result.current.markOptimisticSession('opt-s1'); });
    });
  });

  describe('session switch', () => {
    it('should clear messages when sessionId becomes undefined', () => {
      const { result, rerender } = renderHook(
        ({ sid }) =>
          useChatMessages({ sessionId: sid, isStreaming: false, streamingText: '', streamingReasoning: '' }),
        { initialProps: { sid: 's1' as string | undefined } }
      );

      act(() => { result.current.addUserMessage('msg-1', 'hello'); });
      expect(result.current.messages).toHaveLength(1);

      rerender({ sid: undefined });
      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('pendingAssistantMsg', () => {
    it('should show pending assistant when stream finishes on matching session', () => {
      const { result, rerender } = renderHook(
        ({ isStreaming, text }) =>
          useChatMessages({ sessionId: 's1', isStreaming, streamingText: text, streamingReasoning: '' }),
        { initialProps: { isStreaming: true, text: '' } }
      );

      act(() => { result.current.setStreamSessionId('s1'); });
      rerender({ isStreaming: false, text: 'AI 回复内容' });

      expect(result.current.pendingAssistantMsg).toBeTruthy();
      expect(result.current.pendingAssistantMsg?.content).toBe('AI 回复内容');
    });

    it('should NOT show pending assistant for stream from different session', () => {
      const { result, rerender } = renderHook(
        ({ isStreaming, text }) =>
          useChatMessages({ sessionId: 's1', isStreaming, streamingText: text, streamingReasoning: '' }),
        { initialProps: { isStreaming: true, text: '' } }
      );

      act(() => { result.current.setStreamSessionId('s2'); });
      rerender({ isStreaming: false, text: '其他会话的内容' });

      expect(result.current.pendingAssistantMsg).toBeNull();
    });
  });
});
