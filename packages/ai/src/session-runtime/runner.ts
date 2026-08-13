import { clampMaxSteps, createDoomLoopTracker } from './guards'
import {
  emitTurnFinished,
  emitTurnStarted,
  needsProviderTurnContinuation,
  type ProviderTurnResult
} from './turn'
import { emitAgentSessionRuntime } from '../agent/session-runtime-event'

export interface SessionRunnerTurnHooks {
  /** 执行单次 provider turn（通常 streamText + maxSteps:1） */
  runTurn: (turnIndex: number) => Promise<{
    finishReason: string
    hadToolCalls: boolean
    usage?: ProviderTurnResult['usage']
    aborted?: boolean
  }>
  /** 每 turn 前（epoch.prepare 等） */
  beforeTurn?: (turnIndex: number) => Promise<void> | void
  /** doom-loop 观察：每次 tool 调用 */
  onToolCall?: (toolName: string, args: unknown) => void
}

/**
 * 显式 provider-turn 外环：直到不需续跑或触达 maxSteps / doom-loop / abort。
 */
export async function runSessionTurnLoop(params: {
  sessionId: string
  maxSteps?: number
  doomLoopThreshold?: number
  hooks: SessionRunnerTurnHooks
  abortSignal?: AbortSignal
}): Promise<{ turns: number; stoppedReason: string }> {
  const maxSteps = clampMaxSteps(params.maxSteps, 10)
  const doom = createDoomLoopTracker(params.doomLoopThreshold ?? 3)
  let turns = 0
  let stoppedReason = 'completed'

  for (let turnIndex = 0; turnIndex < maxSteps; turnIndex++) {
    if (params.abortSignal?.aborted) {
      stoppedReason = 'aborted'
      break
    }

    await params.hooks.beforeTurn?.(turnIndex)
    emitTurnStarted(params.sessionId, turnIndex)

    const turn = await params.hooks.runTurn(turnIndex)
    turns = turnIndex + 1

    const continueNeeded = needsProviderTurnContinuation({
      finishReason: turn.finishReason,
      hadToolCalls: turn.hadToolCalls,
      turnIndex,
      maxSteps,
      aborted: turn.aborted || params.abortSignal?.aborted,
      doomLoopTripped: false
    })

    emitTurnFinished(params.sessionId, turnIndex, {
      finishReason: turn.finishReason,
      needsContinuation: continueNeeded,
      usage: turn.usage
    })

    if (turn.aborted || params.abortSignal?.aborted) {
      stoppedReason = 'aborted'
      break
    }

    if (!continueNeeded) {
      stoppedReason = turn.finishReason || 'stop'
      break
    }
  }

  if (turns >= maxSteps && stoppedReason === 'completed') {
    stoppedReason = 'max_steps'
  }

  void doom
  return { turns, stoppedReason }
}

/** 供 stream 路径挂接：观察 tool 指纹，熔断时发事件 */
export function attachDoomLoopObserver(params: {
  sessionId: string
  threshold?: number
  onTripped?: () => void
}): {
  observe: (toolName: string, args: unknown) => boolean
  reset: () => void
} {
  const tracker = createDoomLoopTracker(params.threshold ?? 3)
  return {
    observe(toolName: string, args: unknown) {
      const r = tracker.observe(toolName, args)
      if (r.tripped) {
        emitAgentSessionRuntime({
          type: 'session.doom_loop',
          sessionId: params.sessionId,
          toolName,
          fingerprint: r.fingerprint,
          repeatCount: r.count,
          timestamp: Date.now()
        })
        params.onTripped?.()
      }
      return r.tripped
    },
    reset: () => tracker.reset()
  }
}
