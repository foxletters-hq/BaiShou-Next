import {
  shouldReportAgentStreamAsError,
  type AgentStreamErrorReportExtras
} from './companion-ask-reject.util'

/** 用户停止 / 门控拒绝不是落盘失败，不应打「流式过程发生错误」。 */
export function shouldWarnLimitedPersist(
  streamError: unknown,
  extras?: AgentStreamErrorReportExtras
): boolean {
  return Boolean(streamError) && shouldReportAgentStreamAsError(streamError, extras)
}

/** 中止或拒绝后仍可尝试读 SDK usage；读失败再退回 Accumulator。 */
export function shouldReadStreamUsageAfterInterrupt(
  streamError: unknown,
  extras?: AgentStreamErrorReportExtras
): boolean {
  return !shouldWarnLimitedPersist(streamError, extras)
}
