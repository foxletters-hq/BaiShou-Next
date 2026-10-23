import type { AgentSessionKind } from './workspace.types'
import type { AgentSessionRuntimeControlEvent } from './session-runtime-control.types'

/** Token usage snapshot attached to step / stream finish events */
export interface SessionRuntimeTokenUsage {
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheWriteInputTokens?: number
}

export interface SessionPromptAdmittedEvent {
  type: 'session.prompt_admitted'
  sessionId: string
  userMessageId?: string
  sessionKind?: AgentSessionKind
  timestamp: number
}

export interface SessionStepStartedEvent {
  type: 'session.step_started'
  sessionId: string
  stepIndex: number
  timestamp: number
}

/** 控制面工具 IO 摘要：避免经 IPC 广播完整大 payload */
export interface SessionRuntimeToolPayloadSummary {
  /** 截断预览，最多 200 字符 */
  preview: string
  truncated: boolean
  charLength: number
  byteLength?: number
}

export interface SessionToolStartedEvent {
  type: 'session.tool_started'
  sessionId: string
  stepIndex: number
  toolCallId: string
  toolName: string
  input: SessionRuntimeToolPayloadSummary
  timestamp: number
}

export interface SessionToolCompletedEvent {
  type: 'session.tool_completed'
  sessionId: string
  stepIndex: number
  toolCallId: string
  toolName: string
  output: SessionRuntimeToolPayloadSummary
  timestamp: number
}

export interface SessionToolFailedEvent {
  type: 'session.tool_failed'
  sessionId: string
  stepIndex: number
  toolCallId: string
  toolName: string
  error: string
  timestamp: number
}

export interface SessionStepEndedEvent {
  type: 'session.step_ended'
  sessionId: string
  stepIndex: number
  finishReason: string
  usage?: SessionRuntimeTokenUsage
  timestamp: number
}

export interface SessionStepFailedEvent {
  type: 'session.step_failed'
  sessionId: string
  stepIndex: number
  error: string
  timestamp: number
}

export interface SessionInterruptedEvent {
  type: 'session.interrupted'
  sessionId: string
  reason: string
  timestamp: number
}

export interface SessionStreamFinishedEvent {
  type: 'session.stream_finished'
  sessionId: string
  success: boolean
  messageId?: string
  error?: string
  usage?: SessionRuntimeTokenUsage
  timestamp: number
}

export type AgentSessionRuntimeEvent =
  | SessionPromptAdmittedEvent
  | SessionStepStartedEvent
  | SessionToolStartedEvent
  | SessionToolCompletedEvent
  | SessionToolFailedEvent
  | SessionStepEndedEvent
  | SessionStepFailedEvent
  | SessionInterruptedEvent
  | SessionStreamFinishedEvent
  | AgentSessionRuntimeControlEvent

export type AgentSessionRuntimeListener = (event: AgentSessionRuntimeEvent) => void
