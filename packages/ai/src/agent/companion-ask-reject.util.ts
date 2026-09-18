import {
  companionAskCancelledMessage,
  isAgentGateRejectedError,
  isAgentStreamAbortError
} from '@baishou/shared'
import type { StreamTimelineItem } from './stream-accumulator'

/** 用户拒绝或主动停止不应再当成流式致命错误上报 */
export function shouldReportAgentStreamAsError(error: unknown): boolean {
  if (error == null) return false
  if (isAgentStreamAbortError(error)) return false
  if (isAgentGateRejectedError(error)) return false
  return true
}

/** 拒绝中断后补上取消说明，避免提问行落成工具执行失败 */
export function applyRejectedCompanionAskResults(timeline: readonly StreamTimelineItem[]): void {
  for (const item of timeline) {
    if (item.kind !== 'tool' || item.name !== 'companion_ask') continue
    if (item.result != null && item.result !== '') continue
    item.status = 'completed'
    item.result = companionAskCancelledMessage()
  }
}
