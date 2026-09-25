import {
  companionAskCancelledMessage,
  isAgentGateRejectedError,
  isAgentStreamAbortError,
  TOOL_EXECUTION_FAILED_PREFIX
} from '@baishou/shared'
import type { StreamTimelineItem } from './stream-accumulator'

export const UNEXPECTED_AGENT_STREAM_ABORT_MESSAGE = '生成已中断，请重试'

export type AgentStreamErrorReportExtras = {
  userAborted?: boolean
}

/** 用户拒绝或主动停止不应再当成流式致命错误上报 */
export function shouldReportAgentStreamAsError(
  error: unknown,
  extras?: AgentStreamErrorReportExtras
): boolean {
  if (error == null) return false
  if (isAgentGateRejectedError(error)) return false
  if (isAgentStreamAbortError(error) && extras?.userAborted) return false
  return true
}

/** 拒绝中断后补上取消说明，避免提问行落成工具执行失败 */
export function applyRejectedCompanionAskResults(timeline: readonly StreamTimelineItem[]): void {
  for (const item of timeline) {
    if (item.kind !== 'tool' || item.name !== 'companion_ask') continue
    if (item.result != null && item.result !== '') continue
    item.status = 'completed'
    item.result = companionAskCancelledMessage()
    if (item.startTime != null) {
      item.durationMs = Math.max(0, Date.now() - item.startTime)
    }
  }
}

/** 真正失败时给未完成工具补上失败结果，避免界面一直停在执行中 */
export function applyFailedIncompleteToolResults(
  timeline: readonly StreamTimelineItem[],
  errorMessage: string
): void {
  const detail = errorMessage.trim() || '未知错误'
  const result = `${TOOL_EXECUTION_FAILED_PREFIX}: ${detail}`
  for (const item of timeline) {
    if (item.kind !== 'tool') continue
    if (item.result != null && item.result !== '') continue
    item.status = 'failed'
    item.result = result
    if (item.startTime != null) {
      item.durationMs = Math.max(0, Date.now() - item.startTime)
    }
  }
}
