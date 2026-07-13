import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDiaryCodeMirrorBridge } from '../useDiaryCodeMirrorBridge'
import {
  parseDiaryCmFromWebViewMessage,
  type DiaryCmToWebViewMessage
} from '../../../shared/diary-codemirror/types'

const theme = {
  isDark: false,
  textPrimary: '#111',
  textSecondary: '#666',
  bgEditor: '#fff',
  borderColor: '#ddd',
  primary: '#007aff',
  tagColors: ['#60A5FA', '#34D399', '#F59E0B', '#A78BFA'] as [string, string, string, string]
}

function attachMockWebView(bridge: ReturnType<typeof useDiaryCodeMirrorBridge>) {
  const postMessage = vi.fn()
  const injectJavaScript = vi.fn()
  Object.defineProperty(bridge.webViewRef, 'current', {
    configurable: true,
    writable: true,
    value: { postMessage, injectJavaScript }
  })
  return postMessage
}

function postedMessages(postMessage: ReturnType<typeof vi.fn>): DiaryCmToWebViewMessage[] {
  return postMessage.mock.calls.map(([raw]) => JSON.parse(raw as string))
}

function sendFromWebView(
  bridge: ReturnType<typeof useDiaryCodeMirrorBridge>,
  message: Record<string, unknown>
) {
  act(() => {
    bridge.onWebViewMessage({ nativeEvent: { data: JSON.stringify(message) } })
  })
}

function markReady(bridge: ReturnType<typeof useDiaryCodeMirrorBridge>) {
  sendFromWebView(bridge, { type: 'ready' })
}

describe('useDiaryCodeMirrorBridge ready queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queues outbound commands until WebView ready, then flushes after init', () => {
    const { result } = renderHook(() => useDiaryCodeMirrorBridge({ content: 'seed', theme }))
    const postMessage = attachMockWebView(result.current)

    act(() => {
      result.current.insertAtCursor('queued text')
      result.current.focusAtOffset(4)
    })
    expect(postMessage).not.toHaveBeenCalled()
    expect(result.current.isReady()).toBe(false)

    markReady(result.current)

    expect(result.current.isReady()).toBe(true)
    const messages = postedMessages(postMessage)
    expect(messages[0]).toMatchObject({
      type: 'init',
      payload: { content: 'seed', interactionMode: 'touch' }
    })
    expect(messages.slice(1)).toEqual([
      { type: 'insertAtCursor', payload: { text: 'queued text' } },
      { type: 'setSelection', payload: { start: 4, end: 4 } },
      { type: 'focus' }
    ])
  })

  it('sends commands immediately once ready', () => {
    const { result } = renderHook(() => useDiaryCodeMirrorBridge({ content: 'live', theme }))
    const postMessage = attachMockWebView(result.current)
    markReady(result.current)
    postMessage.mockClear()

    act(() => {
      result.current.blur()
    })

    expect(postedMessages(postMessage)).toEqual([{ type: 'blur' }])
    expect(result.current.webViewRef.current?.injectJavaScript).not.toHaveBeenCalled()
  })

  it('does not inject JavaScript when posting toolbar commands', () => {
    const { result } = renderHook(() => useDiaryCodeMirrorBridge({ content: 'live', theme }))
    const postMessage = attachMockWebView(result.current)
    markReady(result.current)
    const inject = result.current.webViewRef.current?.injectJavaScript as ReturnType<typeof vi.fn>
    inject.mockClear()
    postMessage.mockClear()

    act(() => {
      result.current.insertAtCursor('![img](attachment/x)')
    })

    expect(postMessage).toHaveBeenCalledOnce()
    expect(inject).not.toHaveBeenCalled()
  })
})

describe('useDiaryCodeMirrorBridge echo suppress', () => {
  it('ignores WebView change echo after RN setContent sync', () => {
    const onChange = vi.fn()
    const { result, rerender } = renderHook(
      ({ content }) => useDiaryCodeMirrorBridge({ content, theme, onChange }),
      { initialProps: { content: 'initial' } }
    )
    attachMockWebView(result.current)
    markReady(result.current)
    onChange.mockClear()

    rerender({ content: 'switched diary' })

    sendFromWebView(result.current, {
      type: 'change',
      payload: { content: 'switched diary' }
    })
    expect(onChange).not.toHaveBeenCalled()

    sendFromWebView(result.current, {
      type: 'change',
      payload: { content: 'user typed here' }
    })
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('user typed here')
  })

  it('ignores WebView change echo after init mount', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useDiaryCodeMirrorBridge({ content: '##### 07:00\n', theme, onChange })
    )
    attachMockWebView(result.current)
    markReady(result.current)
    onChange.mockClear()

    sendFromWebView(result.current, {
      type: 'change',
      payload: { content: '##### 07:00\n' }
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not push setContent while WebView leads during rapid delete', () => {
    const onChange = vi.fn()
    const { result, rerender } = renderHook(
      ({ content }) => useDiaryCodeMirrorBridge({ content, theme, onChange }),
      { initialProps: { content: 'hello world' } }
    )
    const postMessage = attachMockWebView(result.current)
    markReady(result.current)
    onChange.mockClear()
    postMessage.mockClear()

    sendFromWebView(result.current, {
      type: 'change',
      payload: { content: 'hello worl' }
    })
    expect(onChange).toHaveBeenCalledWith('hello worl')

    rerender({ content: 'hello world' })
    expect(postedMessages(postMessage).some((m) => m.type === 'setContent')).toBe(false)
  })

  it('does not push setContent after WebView deletes to empty while RN still has text', () => {
    const onChange = vi.fn()
    const { result, rerender } = renderHook(
      ({ content }) => useDiaryCodeMirrorBridge({ content, theme, onChange }),
      { initialProps: { content: '残留正文' } }
    )
    const postMessage = attachMockWebView(result.current)
    markReady(result.current)
    postMessage.mockClear()

    sendFromWebView(result.current, {
      type: 'change',
      payload: { content: '' }
    })
    expect(onChange).toHaveBeenCalledWith('')

    // pushSetContent 引用变化或父级重渲染时，空文档也不能被旧正文覆盖
    rerender({ content: '残留正文' })
    expect(postedMessages(postMessage).some((m) => m.type === 'setContent')).toBe(false)
  })

  it('does not suppress unrelated change after echo was consumed', () => {
    const onChange = vi.fn()
    const { result, rerender } = renderHook(
      ({ content }) => useDiaryCodeMirrorBridge({ content, theme, onChange }),
      { initialProps: { content: 'v1' } }
    )
    attachMockWebView(result.current)
    markReady(result.current)
    onChange.mockClear()

    rerender({ content: 'v2' })
    sendFromWebView(result.current, { type: 'change', payload: { content: 'v2' } })
    sendFromWebView(result.current, { type: 'change', payload: { content: 'v2 again' } })

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('v2 again')
  })
})

describe('useDiaryCodeMirrorBridge onWebViewMessage', () => {
  it('ignores malformed WebView payloads', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useDiaryCodeMirrorBridge({ content: 'x', theme, onChange }))
    attachMockWebView(result.current)

    act(() => {
      result.current.onWebViewMessage({ nativeEvent: { data: '{bad json' } })
      result.current.onWebViewMessage({
        nativeEvent: { data: JSON.stringify({ type: 'setContent', payload: { content: 'nope' } }) }
      })
    })

    expect(onChange).not.toHaveBeenCalled()
    expect(parseDiaryCmFromWebViewMessage('{bad json')).toBeNull()
  })

  it('requests ready again when load ends before handshake', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDiaryCodeMirrorBridge({ content: 'seed', theme }))
    const postMessage = attachMockWebView(result.current)

    act(() => {
      result.current.onWebViewLoadStart()
      result.current.onWebViewLoadEnd()
    })

    act(() => {
      vi.advanceTimersByTime(80)
    })

    expect(postedMessages(postMessage).some((m) => m.type === 'requestReady')).toBe(true)

    act(() => {
      vi.advanceTimersByTime(330)
    })

    expect(postedMessages(postMessage).some((m) => m.type === 'init')).toBe(true)
    vi.useRealTimers()
  })

  it('ignores bundle leak in change events', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useDiaryCodeMirrorBridge({ content: 'ok', theme, onChange })
    )
    attachMockWebView(result.current)
    markReady(result.current)
    onChange.mockClear()

    sendFromWebView(result.current, {
      type: 'change',
      payload: {
        content:
          'Object.defineProperty matchBefore createDiaryCodeMirror ReactNativeWebView ' +
          'x'.repeat(200)
      }
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('forwards dismissKeyboard to onDismissKeyboard', () => {
    const onDismissKeyboard = vi.fn()
    const { result } = renderHook(() =>
      useDiaryCodeMirrorBridge({ content: 'x', theme, onDismissKeyboard })
    )
    attachMockWebView(result.current)

    act(() => {
      result.current.onWebViewMessage({
        nativeEvent: { data: JSON.stringify({ type: 'dismissKeyboard' }) }
      })
    })

    expect(onDismissKeyboard).toHaveBeenCalledOnce()
  })

  it('forwards confirmRequest to onConfirmRequest and can respond', () => {
    const onConfirmRequest = vi.fn(
      (_payload: { requestId: string }, respond: (confirmed: boolean) => void) => {
        respond(true)
      }
    )
    const { result } = renderHook(() =>
      useDiaryCodeMirrorBridge({ content: 'x', theme, onConfirmRequest })
    )
    const postMessage = attachMockWebView(result.current)
    markReady(result.current)

    act(() => {
      result.current.onWebViewMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'confirmRequest',
            payload: {
              requestId: 'c1',
              message: '确定删除？'
            }
          })
        }
      })
    })

    expect(onConfirmRequest).toHaveBeenCalledOnce()
    expect(postedMessages(postMessage).some((m) => m.type === 'confirmResponse')).toBe(true)
  })
})
