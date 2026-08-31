import { describe, expect, it } from 'vitest'
import {
  shouldShowStreamWaitingDots,
  streamTimelineHasRunningTool
} from '../workspace-stream-waiting.util'

describe('streamTimelineHasRunningTool', () => {
  it('treats an active tool name as running', () => {
    expect(streamTimelineHasRunningTool([], 'url_read')).toBe(true)
  })

  it('detects a running tool in the live timeline', () => {
    expect(
      streamTimelineHasRunningTool([
        { kind: 'reasoning', status: 'completed' },
        { kind: 'tool', status: 'running' }
      ])
    ).toBe(true)
  })

  it('returns false when no tool is running', () => {
    expect(
      streamTimelineHasRunningTool([
        { kind: 'tool', status: 'completed' },
        { kind: 'text' }
      ])
    ).toBe(false)
  })
})

describe('shouldShowStreamWaitingDots', () => {
  const idle = {
    isStreaming: true,
    isBridgeActive: false,
    streamError: null,
    lastItemIsLiveText: false,
    hasRunningTool: false
  }

  it('shows dots while waiting for the first token', () => {
    expect(shouldShowStreamWaitingDots(idle)).toBe(true)
  })

  it('hides dots when a tool already shows a spinner', () => {
    expect(shouldShowStreamWaitingDots({ ...idle, hasRunningTool: true })).toBe(false)
  })

  it('hides dots when the model is already streaming text', () => {
    expect(shouldShowStreamWaitingDots({ ...idle, lastItemIsLiveText: true })).toBe(false)
  })

  it('shows dots after tools finish and before the next text token', () => {
    expect(
      shouldShowStreamWaitingDots({
        ...idle,
        hasRunningTool: false,
        lastItemIsLiveText: false
      })
    ).toBe(true)
  })
})
