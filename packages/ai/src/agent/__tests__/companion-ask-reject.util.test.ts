import { describe, expect, it } from 'vitest'
import { AgentGateRejectedError } from '@baishou/shared'
import {
  applyFailedIncompleteToolResults,
  applyRejectedCompanionAskResults,
  shouldReportAgentStreamAsError
} from '../companion-ask-reject.util'
import type { StreamTimelineItem } from '../stream-accumulator'

describe('shouldReportAgentStreamAsError', () => {
  it('should not report a gate rejection as a fatal stream error', () => {
    expect(shouldReportAgentStreamAsError(new AgentGateRejectedError())).toBe(false)
  })

  it('should not report a user abort as a fatal stream error', () => {
    expect(
      shouldReportAgentStreamAsError(new DOMException('The operation was aborted', 'AbortError'), {
        userAborted: true
      })
    ).toBe(false)
  })

  it('should report an unexpected abort as a fatal stream error', () => {
    expect(
      shouldReportAgentStreamAsError(new DOMException('The operation was aborted', 'AbortError'), {
        userAborted: false
      })
    ).toBe(true)
  })

  it('should report ordinary stream failures', () => {
    expect(shouldReportAgentStreamAsError(new Error('模型未返回任何内容'))).toBe(true)
  })
})

describe('applyRejectedCompanionAskResults', () => {
  it('should complete a waiting companion_ask as declined', () => {
    const timeline: StreamTimelineItem[] = [
      {
        kind: 'tool',
        callId: 'ask-1',
        name: 'companion_ask',
        arguments: JSON.stringify({ question: '文件夹叫什么名字？', options: ['写作-2'] }),
        status: 'running'
      }
    ]

    applyRejectedCompanionAskResults(timeline)

    expect(timeline[0]).toEqual(
      expect.objectContaining({
        status: 'completed',
        result: '用户取消了这一次操作'
      })
    )
  })

  it('should write durationMs when a waiting companion_ask had startTime', () => {
    const timeline: StreamTimelineItem[] = [
      {
        kind: 'tool',
        callId: 'ask-1',
        name: 'companion_ask',
        arguments: '{}',
        status: 'running',
        startTime: Date.now() - 80
      }
    ]

    applyRejectedCompanionAskResults(timeline)

    const item = timeline[0]
    expect(item?.kind).toBe('tool')
    if (item?.kind !== 'tool') return
    expect(item.durationMs).toBeGreaterThanOrEqual(80)
  })
})

describe('applyFailedIncompleteToolResults', () => {
  it('should fail a waiting companion_ask with the stream error', () => {
    const timeline: StreamTimelineItem[] = [
      {
        kind: 'tool',
        callId: 'ask-1',
        name: 'companion_ask',
        arguments: JSON.stringify({ question: '继续吗？' }),
        status: 'running'
      }
    ]

    applyFailedIncompleteToolResults(timeline, 'The operation was aborted')

    expect(timeline[0]).toEqual(
      expect.objectContaining({
        status: 'failed',
        result: '工具执行失败: The operation was aborted'
      })
    )
  })

  it('should leave a tool that already has a result unchanged', () => {
    const timeline: StreamTimelineItem[] = [
      {
        kind: 'tool',
        callId: 'ask-1',
        name: 'companion_ask',
        result: '已有结果',
        status: 'completed'
      }
    ]

    applyFailedIncompleteToolResults(timeline, 'boom')

    expect(timeline[0]).toEqual(
      expect.objectContaining({
        status: 'completed',
        result: '已有结果'
      })
    )
  })
})
