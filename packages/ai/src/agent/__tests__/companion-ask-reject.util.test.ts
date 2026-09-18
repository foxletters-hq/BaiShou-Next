import { describe, expect, it } from 'vitest'
import { AgentGateRejectedError } from '@baishou/shared'
import {
  applyRejectedCompanionAskResults,
  shouldReportAgentStreamAsError
} from '../companion-ask-reject.util'
import type { StreamTimelineItem } from '../stream-accumulator'

describe('shouldReportAgentStreamAsError', () => {
  it('should not report a gate rejection as a fatal stream error', () => {
    expect(shouldReportAgentStreamAsError(new AgentGateRejectedError())).toBe(false)
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
})
