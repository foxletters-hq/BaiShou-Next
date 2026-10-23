import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatScroll, type UseChatScrollParams } from '../useChatScroll'

function Harness(props: UseChatScrollParams) {
  const scroll = useChatScroll(props)
  return <div data-testid="pane" ref={scroll.scrollRef} />
}

function setMetrics(pane: HTMLElement, scrollHeight: number, clientHeight = 400) {
  Object.defineProperty(pane, 'scrollHeight', { value: scrollHeight, configurable: true })
  Object.defineProperty(pane, 'clientHeight', { value: clientHeight, configurable: true })
}

const baseParams: Omit<UseChatScrollParams, 'sessionId' | 'messages'> = {
  streamingText: '',
  streamingReasoning: '',
  isStreaming: false,
  activeTool: null
}

describe('useChatScroll session switch', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  it('scrolls to the latest message after stale messages from the previous session are replaced', () => {
    const previousSessionMessages = [{ id: 'old-1', role: 'assistant', sessionId: 's1' }]

    const { rerender } = render(
      <Harness {...baseParams} sessionId="s1" messages={previousSessionMessages} />
    )

    const pane = screen.getByTestId('pane')
    setMetrics(pane, 1200)
    pane.scrollTop = 0

    // 切换会话但消息还没来得及清空：这一帧仍是上一会话的消息
    rerender(<Harness {...baseParams} sessionId="s2" messages={previousSessionMessages} />)
    expect(pane.scrollTop).toBe(1200)

    // 新会话消息清空后，容器回到顶部（空容器贴底即顶部）
    setMetrics(pane, 400)
    pane.scrollTop = 0
    rerender(<Harness {...baseParams} sessionId="s2" messages={[]} />)
    expect(pane.scrollTop).toBe(400)

    // 新会话历史到达：应自动贴到最新一条
    setMetrics(pane, 1200)
    pane.scrollTop = 0
    rerender(
      <Harness
        {...baseParams}
        sessionId="s2"
        messages={[
          { id: 'new-1', role: 'user', sessionId: 's2' },
          { id: 'new-2', role: 'assistant', sessionId: 's2' }
        ]}
      />
    )

    expect(pane.scrollTop).toBe(1200)
  })
})
