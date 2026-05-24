import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentStream } from '../useAgentStream'

function setupWindowMock() {
  const listeners: Record<string, Function> = {}
  const mockRenderer = {
    invoke: vi.fn(),
    on: vi.fn((_channel: string, cb: Function) => {
      const key = _channel
      listeners[key] = cb
      return () => {
        delete listeners[key]
      }
    }),
    removeAllListeners: vi.fn()
  }

  const win = (globalThis as any).window || globalThis
  win.electron = { ipcRenderer: mockRenderer }

  const emit = (channel: string, ...data: any[]) => {
    listeners[channel]?.({} as any, ...data)
  }

  return { mockRenderer, emit }
}

function teardownWindowMock() {
  const win = (globalThis as any).window || globalThis
  if (win) {
    delete win.electron
    delete (win as any).__baishou_stream_registered
  }
}

describe('useAgentStream', () => {
  let mockRenderer: ReturnType<typeof setupWindowMock>['mockRenderer']
  let emit: ReturnType<typeof setupWindowMock>['emit']

  beforeEach(() => {
    const setup = setupWindowMock()
    mockRenderer = setup.mockRenderer
    emit = setup.emit
  })

  afterEach(() => {
    teardownWindowMock()
    vi.restoreAllMocks()
  })

  describe('saveUserMessage', () => {
    it('should invoke agent:save-user-message and return userMessageId', async () => {
      mockRenderer.invoke.mockResolvedValue({
        userMessageId: 'uuid-123',
        attachments: [{ fileName: 'pic.png', url: 'file:///tmp/pic.png' }]
      })

      const { result } = renderHook(() => useAgentStream('s1'))

      let saveResult: any
      await act(async () => {
        saveResult = await result.current.saveUserMessage('s1', '你好', [{ name: 'pic.png' }])
      })

      expect(mockRenderer.invoke).toHaveBeenCalledWith('agent:save-user-message', {
        sessionId: 's1',
        text: '你好',
        attachments: [{ name: 'pic.png' }]
      })
      expect(saveResult).toMatchObject({ userMessageId: 'uuid-123' })
      expect(saveResult.attachments).toEqual([{ fileName: 'pic.png', url: 'file:///tmp/pic.png' }])
    })

    it('should return error object when save fails', async () => {
      mockRenderer.invoke.mockResolvedValue({ error: '磁盘写入失败' })

      const { result } = renderHook(() => useAgentStream('s1'))

      let saveResult: any
      await act(async () => {
        saveResult = await result.current.saveUserMessage('s1', '你好')
      })

      expect(saveResult).toEqual({ error: '磁盘写入失败' })
    })

    it('should not affect isStreaming', async () => {
      mockRenderer.invoke.mockResolvedValue({ userMessageId: 'uuid-456' })

      const { result } = renderHook(() => useAgentStream('s1'))

      await act(async () => {
        await result.current.saveUserMessage('s1', '你好')
      })

      expect(result.current.isStreaming).toBe(false)
    })
  })

  describe('startChat', () => {
    it('should set isStreaming and invoke agent:chat', async () => {
      mockRenderer.invoke.mockResolvedValue(true)

      const { result } = renderHook(() => useAgentStream('s1'))

      await act(async () => {
        await result.current.startChat('s1', '你好', 'p1', 'm1', [], false)
      })

      expect(mockRenderer.invoke).toHaveBeenCalledWith('agent:chat', {
        sessionId: 's1',
        text: '你好',
        providerId: 'p1',
        modelId: 'm1',
        attachments: [],
        searchMode: false
      })
      expect(result.current.isStreaming).toBe(true)
    })

    it('should reset text and error before starting', async () => {
      mockRenderer.invoke.mockImplementation(() => new Promise(() => {}))

      const { result } = renderHook(() => useAgentStream('s1'))

      await act(async () => {
        result.current.startChat('s1', '新消息')
      })

      expect(result.current.isStreaming).toBe(true)
      expect(result.current.text).toBe('')
      expect(result.current.reasoning).toBe('')
      expect(result.current.error).toBeNull()
    })

    it('should clear previously accumulated text on new chat', async () => {
      const { result } = renderHook(() => useAgentStream('s1'))

      mockRenderer.invoke.mockResolvedValue(true)
      await act(async () => {
        result.current.startChat('s1', 'first')
      })

      act(() => {
        emit('agent:stream-chunk', { sessionId: 's1', chunk: 'Hello' })
      })
      act(() => {
        emit('agent:stream-chunk', { sessionId: 's1', chunk: 'World' })
      })
      expect(result.current.text).toBe('HelloWorld')

      mockRenderer.invoke.mockResolvedValue(true)
      await act(async () => {
        await result.current.startChat('s1', 'second')
      })
      expect(result.current.text).toBe('')
    })
  })

  describe('stream events', () => {
    it('should set isStreaming false on stream-finish success', () => {
      const { result } = renderHook(() => useAgentStream('s1'))
      act(() => {
        emit('agent:stream-finish', { sessionId: 's1', success: true })
      })
      expect(result.current.isStreaming).toBe(false)
    })

    it('should set error on stream-finish with error payload', () => {
      const { result } = renderHook(() => useAgentStream('s1'))
      act(() => {
        emit('agent:stream-finish', { sessionId: 's1', error: '超时错误' })
      })
      expect(result.current.isStreaming).toBe(false)
      expect(result.current.error).toBe('超时错误')
    })

    it('should accumulate text from stream-chunk events', () => {
      const { result } = renderHook(() => useAgentStream('s1'))
      act(() => {
        emit('agent:stream-chunk', { sessionId: 's1', chunk: 'Hello ' })
      })
      act(() => {
        emit('agent:stream-chunk', { sessionId: 's1', chunk: 'World' })
      })
      expect(result.current.text).toBe('Hello World')
    })

    it('should accumulate reasoning from reasoning-chunk events', () => {
      const { result } = renderHook(() => useAgentStream('s1'))
      act(() => {
        emit('agent:reasoning-chunk', { sessionId: 's1', chunk: 'thinking...' })
      })
      expect(result.current.reasoning).toBe('thinking...')
    })

    it('should handle tool-start event', () => {
      const { result } = renderHook(() => useAgentStream('s1'))
      act(() => {
        emit('agent:tool-start', { sessionId: 's1', name: 'diary_search', args: { query: 'test' } })
      })
      expect(result.current.activeTool).toEqual({ name: 'diary_search', args: { query: 'test' } })
    })

    it('should handle tool-result event', () => {
      const { result } = renderHook(() => useAgentStream('s1'))
      act(() => {
        emit('agent:tool-start', { sessionId: 's1', name: 'diary_search', args: {} })
      })
      act(() => {
        emit('agent:tool-result', { sessionId: 's1', name: 'diary_search' })
      })
      expect(result.current.activeTool).toBeNull()
      expect(result.current.completedTools.length).toBe(1)
      expect(result.current.completedTools[0].name).toBe('diary_search')
    })
  })

  describe('reset', () => {
    it('should clear all streaming state', () => {
      const { result } = renderHook(() => useAgentStream('s1'))
      act(() => {
        result.current.reset()
      })
      expect(result.current.text).toBe('')
      expect(result.current.reasoning).toBe('')
      expect(result.current.isStreaming).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.activeTool).toBeNull()
      expect(result.current.completedTools).toEqual([])
    })
  })
})
