import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatMessages } from '../useChatMessages'
import { chatSessionMessageCache } from '../../utils/chat-session-message-cache'

function setupWindowMock() {
  const mockRenderer = {
    invoke: vi.fn(),
    on: vi.fn(() => () => {}),
    removeAllListeners: vi.fn()
  }

  const win = (globalThis as any).window || globalThis
  win.electron = { ipcRenderer: mockRenderer }

  return { mockRenderer }
}

function teardownWindowMock() {
  const win = (globalThis as any).window
  if (win) {
    delete win.electron
  }
}

describe('useChatMessages', () => {
  let mockRenderer: ReturnType<typeof setupWindowMock>['mockRenderer']

  beforeEach(() => {
    const setup = setupWindowMock()
    mockRenderer = setup.mockRenderer
    mockRenderer.invoke.mockResolvedValue([])
    chatSessionMessageCache.clear()
  })

  afterEach(() => {
    teardownWindowMock()
    vi.restoreAllMocks()
  })

  describe('optimisticRemove', () => {
    it('should remove an existing message by ID', () => {
      const { result } = renderHook(() =>
        useChatMessages({
          sessionId: 's1',
          isStreaming: false,
          streamingText: '',
          streamingReasoning: ''
        })
      )

      act(() => {
        result.current.setMessages([{ id: 'msg-1', role: 'user', content: 'test' }])
      })
      expect(result.current.messages).toHaveLength(1)

      act(() => {
        result.current.optimisticRemove('msg-1')
      })
      expect(result.current.messages).toHaveLength(0)
    })

    it('should be a no-op for non-existent message ID', () => {
      const { result } = renderHook(() =>
        useChatMessages({
          sessionId: 's1',
          isStreaming: false,
          streamingText: '',
          streamingReasoning: ''
        })
      )

      act(() => {
        result.current.setMessages([{ id: 'msg-1', role: 'user', content: 'test' }])
      })
      act(() => {
        result.current.optimisticRemove('nonexistent')
      })

      expect(result.current.messages).toHaveLength(1)
    })
  })

  describe('refreshMessages', () => {
    it('should fetch messages from IPC and replace state', async () => {
      const dbMessages = [
        {
          id: 'db-1',
          role: 'user',
          content: '历史消息',
          createdAt: new Date().toISOString()
        },
        {
          id: 'db-2',
          role: 'assistant',
          content: 'AI 回复',
          createdAt: new Date().toISOString()
        }
      ]
      mockRenderer.invoke.mockResolvedValue(dbMessages)

      const { result } = renderHook(() =>
        useChatMessages({
          sessionId: 's1',
          isStreaming: false,
          streamingText: '',
          streamingReasoning: ''
        })
      )

      await act(async () => {
        await result.current.refreshMessages(2)
      })

      expect(mockRenderer.invoke).toHaveBeenCalledWith('agent:get-messages', 's1', 60, 0, false)
      expect(result.current.messages).toHaveLength(2)
      expect(result.current.messages[0].id).toBe('db-1')
    })

    it('should return false when IPC returns null or empty', async () => {
      mockRenderer.invoke.mockResolvedValue(null)

      const { result } = renderHook(() =>
        useChatMessages({
          sessionId: 's1',
          isStreaming: false,
          streamingText: '',
          streamingReasoning: ''
        })
      )

      let success = true
      await act(async () => {
        success = await result.current.refreshMessages(2)
      })

      expect(success).toBe(false)
    })
  })

  describe('ref setters', () => {
    it('should accept setStreamSessionId without errors', () => {
      const { result } = renderHook(() =>
        useChatMessages({
          sessionId: 's1',
          isStreaming: false,
          streamingText: '',
          streamingReasoning: ''
        })
      )

      act(() => {
        result.current.setStreamSessionId('stream-s1')
      })
    })
  })

  describe('session switch', () => {
    it('should clear messages when sessionId becomes undefined', () => {
      const { result, rerender } = renderHook(
        ({ sid }) =>
          useChatMessages({
            sessionId: sid,
            isStreaming: false,
            streamingText: '',
            streamingReasoning: ''
          }),
        { initialProps: { sid: 's1' as string | undefined } }
      )

      act(() => {
        result.current.setMessages([{ id: 'msg-1', role: 'user', content: 'hello' }])
      })
      expect(result.current.messages).toHaveLength(1)

      rerender({ sid: undefined })
      expect(result.current.messages).toHaveLength(0)
    })

    it('should reload pagination from server when switching sessions', async () => {
      const s1Messages = Array.from({ length: 12 }, (_, i) => ({
        id: `s1-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `m${i}`
      }))
      const s2Messages = [
        { id: 's2-0', role: 'user', content: 'other' },
        { id: 's2-1', role: 'assistant', content: 'reply' }
      ]

      mockRenderer.invoke.mockImplementation(async (_channel, sessionId: string) => {
        if (sessionId === 's1') return s1Messages
        if (sessionId === 's2') return s2Messages
        return []
      })

      const { rerender } = renderHook(
        ({ sid }) =>
          useChatMessages({
            sessionId: sid,
            isStreaming: false,
            streamingText: '',
            streamingReasoning: ''
          }),
        { initialProps: { sid: 's1' as string | undefined } }
      )

      await act(async () => {
        await Promise.resolve()
      })

      mockRenderer.invoke.mockClear()
      rerender({ sid: 's2' })

      await act(async () => {
        await Promise.resolve()
      })

      expect(mockRenderer.invoke).toHaveBeenCalledWith('agent:get-messages', 's2', 60, 0, false)
    })

    it('should restore cached messages with token usage when switching back', async () => {
      const s1Messages = [
        { id: 'u1', role: 'user', content: 'hi' },
        {
          id: 'a1',
          role: 'assistant',
          content: 'reply',
          inputTokens: 47300,
          outputTokens: 601,
          costMicros: 1200,
          cacheReadInputTokens: 46100
        }
      ]

      mockRenderer.invoke.mockImplementation(async (_channel, sessionId: string) => {
        if (sessionId === 's1') return s1Messages
        if (sessionId === 's2') return [{ id: 'b1', role: 'user', content: 'other' }]
        return []
      })

      const { result, rerender } = renderHook(
        ({ sid }) =>
          useChatMessages({
            sessionId: sid,
            isStreaming: false,
            streamingText: '',
            streamingReasoning: ''
          }),
        { initialProps: { sid: 's1' as string | undefined } }
      )

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(result.current.messages.find((m) => m.id === 'a1')?.inputTokens).toBe(47300)

      mockRenderer.invoke.mockClear()
      rerender({ sid: 's2' })

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      mockRenderer.invoke.mockClear()
      rerender({ sid: 's1' })

      await act(async () => {
        await Promise.resolve()
      })

      expect(mockRenderer.invoke).not.toHaveBeenCalled()
      const restored = result.current.messages.find((m) => m.id === 'a1')
      expect(restored?.inputTokens).toBe(47300)
      expect(restored?.cacheReadInputTokens).toBe(46100)
    })
  })

  describe('refreshLatestMessages pagination reset', () => {
    it('should collapse expanded history when resetPagination is true', async () => {
      const dbMessages = Array.from({ length: 12 }, (_, i) => ({
        id: String(i),
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `m${i}`
      }))
      mockRenderer.invoke.mockResolvedValue(dbMessages)

      const { result } = renderHook(() =>
        useChatMessages({
          sessionId: 's1',
          isStreaming: false,
          streamingText: '',
          streamingReasoning: ''
        })
      )

      await act(async () => {
        await Promise.resolve()
      })

      expect(result.current.messages).toHaveLength(6)

      await act(async () => {
        await result.current.loadMore()
      })

      expect(result.current.messages.length).toBeGreaterThan(6)

      mockRenderer.invoke.mockResolvedValue(dbMessages)
      await act(async () => {
        await result.current.refreshLatestMessages(1, 's1', { resetPagination: true })
      })

      expect(result.current.messages).toHaveLength(6)
    })
  })

  describe('stream finish sync', () => {
    it('should refresh messages and clear stream bridge when stream finishes on matching session', async () => {
      const fetchSpy = vi.fn().mockResolvedValue([
        { id: 'u1', role: 'user', content: 'hi', orderIndex: 0 },
        {
          id: 'a1',
          role: 'assistant',
          content: 'AI 回复内容',
          orderIndex: 1
        }
      ])
      mockRenderer.invoke.mockImplementation(fetchSpy)

      const { result, rerender } = renderHook(
        ({ isStreaming }) =>
          useChatMessages({
            sessionId: 's1',
            isStreaming,
            streamingText: '',
            streamingReasoning: ''
          }),
        { initialProps: { isStreaming: true } }
      )

      act(() => {
        result.current.setStreamSessionId('s1')
      })
      rerender({ isStreaming: false })

      await act(async () => {
        await Promise.resolve()
      })

      expect(fetchSpy).toHaveBeenCalled()
    })

    it('should NOT refresh when stream finishes for a different session', async () => {
      const fetchSpy = vi.fn().mockResolvedValue([])
      mockRenderer.invoke.mockImplementation(fetchSpy)

      const { result, rerender } = renderHook(
        ({ isStreaming }) =>
          useChatMessages({
            sessionId: 's1',
            isStreaming,
            streamingText: '',
            streamingReasoning: ''
          }),
        { initialProps: { isStreaming: true } }
      )

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      fetchSpy.mockClear()

      act(() => {
        result.current.setStreamSessionId('s2')
      })
      rerender({ isStreaming: false })

      await act(async () => {
        await Promise.resolve()
      })

      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})
