import { emitAgentSessionRuntime } from '../agent/session-runtime-event'

export interface ProviderTurnResult {
  finishReason: string
  needsContinuation: boolean
  usage?: {
    inputTokens?: number
    outputTokens?: number
    cacheReadInputTokens?: number
    cacheWriteInputTokens?: number
  }
}

/**
 * 判断单次 provider-turn 后是否需要续跑。
 * tool-calls / 仍有未完成工具结果时继续。
 */
export function needsProviderTurnContinuation(params: {
  finishReason: string
  hadToolCalls: boolean
  turnIndex: number
  maxSteps: number
  aborted?: boolean
  doomLoopTripped?: boolean
}): boolean {
  if (params.aborted || params.doomLoopTripped) return false
  if (params.turnIndex + 1 >= params.maxSteps) return false
  const reason = (params.finishReason || '').toLowerCase()
  if (reason === 'tool-calls' || reason === 'tool_calls') return true
  // 部分供应商 finishReason 为空/unknown 且本 turn 有 tool calls → 续跑；普通 stop 不续跑
  if (params.hadToolCalls && (reason === 'unknown' || reason === '')) {
    return true
  }
  return false
}

export function emitTurnStarted(sessionId: string, turnIndex: number): void {
  emitAgentSessionRuntime({
    type: 'session.turn_started',
    sessionId,
    turnIndex,
    timestamp: Date.now()
  })
}

export function emitTurnFinished(
  sessionId: string,
  turnIndex: number,
  result: ProviderTurnResult
): void {
  emitAgentSessionRuntime({
    type: 'session.turn_finished',
    sessionId,
    turnIndex,
    finishReason: result.finishReason,
    needsContinuation: result.needsContinuation,
    usage: result.usage,
    timestamp: Date.now()
  })
}
