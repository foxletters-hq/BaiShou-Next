import type { AgentSessionKind } from './workspace.types'
import type { SessionInputDelivery } from './session-runtime-inbox.types'
import type { SessionRuntimeTokenUsage } from './session-runtime-event.types'

export interface SessionPromotedEvent {
  type: 'session.promoted'
  sessionId: string
  inputId: string
  delivery: SessionInputDelivery
  timestamp: number
}

export interface SessionTurnStartedEvent {
  type: 'session.turn_started'
  sessionId: string
  turnIndex: number
  timestamp: number
}

export interface SessionTurnFinishedEvent {
  type: 'session.turn_finished'
  sessionId: string
  turnIndex: number
  finishReason: string
  needsContinuation: boolean
  usage?: SessionRuntimeTokenUsage
  timestamp: number
}

export interface SessionIdleEvent {
  type: 'session.idle'
  sessionId: string
  timestamp: number
}

export interface SessionInputQueuedEvent {
  type: 'session.input_queued'
  sessionId: string
  inputId: string
  delivery: SessionInputDelivery
  timestamp: number
}

export interface SessionDoomLoopEvent {
  type: 'session.doom_loop'
  sessionId: string
  toolName: string
  fingerprint: string
  repeatCount: number
  timestamp: number
}

export interface SessionEpochReplacedEvent {
  type: 'session.epoch_replaced'
  sessionId: string
  baselineSeq: number
  timestamp: number
}

export interface SessionRecoveryMarkedEvent {
  type: 'session.recovery_marked'
  sessionId: string
  reason: string
  timestamp: number
}

export type AgentSessionRuntimeControlEvent =
  | SessionPromotedEvent
  | SessionTurnStartedEvent
  | SessionTurnFinishedEvent
  | SessionIdleEvent
  | SessionInputQueuedEvent
  | SessionDoomLoopEvent
  | SessionEpochReplacedEvent
  | SessionRecoveryMarkedEvent

export interface SessionRuntimeProfile {
  sessionKind?: AgentSessionKind
  /** 启用显式 provider-turn 外环 */
  sessionRuntimeV2?: boolean
  maxSteps?: number
  doomLoopThreshold?: number
  interruptOnGateReject?: boolean
}
