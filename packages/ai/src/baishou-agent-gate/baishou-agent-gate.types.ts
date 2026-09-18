import {
  AgentGateEffect,
  type AgentGateAssertInput,
  type AgentGateConfigScope,
  type AgentGateEvaluateInput,
  type AgentGatePreview,
  type AgentGateProfileId,
  type AgentGateReplyInput,
  type AgentGateRequest,
  type AgentGateResolution,
  type AgentGateResourceRef,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import type { BaishouAgentGateEventBus } from './baishou-agent-gate-event-bus'
import type { AgentGateRepeatTracker } from './baishou-agent-gate-repeat.tracker'
import type { AgentGateRiskClassifier } from './agent-gate-risk-classifier.types'

export interface IBaishouAgentGate {
  assert(input: AgentGateAssertInput): Promise<void>
  assertWithResolution(input: AgentGateAssertInput): Promise<AgentGateResolution>
  ask(input: AgentGateAssertInput): Promise<AgentGateRequest>
  reply(input: AgentGateReplyInput): Promise<void>
  get(requestId: string): AgentGateRequest | undefined
  listPending(sessionId?: string): AgentGateRequest[]
  cancelSession(sessionId: string, reason?: string): void
  /** Non-blocking policy probe (e.g. hideDeniedTools). */
  probeEffect(input: AgentGateEvaluateInput): AgentGateEffect
}

export interface PendingWaiter {
  resolve: (resolution: AgentGateResolution) => void
  reject: (error: Error) => void
}

export interface PendingEntry {
  request: AgentGateRequest
  fingerprint: string
  coalesceKey?: string | null
  resources?: AgentGateResourceRef[]
  profileId?: AgentGateProfileId
  waiters: PendingWaiter[]
}

export interface CreateBaishouAgentGateOptions {
  config: BaishouAgentGateConfig
  persistConfig?: () => Promise<void>
  eventBus?: BaishouAgentGateEventBus
  repeatTracker?: AgentGateRepeatTracker
  /** 写入 allowlist_changed 事件，便于 UI 按场景刷新 */
  configScope?: AgentGateConfigScope
  /** G4：工作区自动接受（运行时查询，不进配置） */
  isAutoAccept?: () => boolean
  /** G5：auto_review 模式下的模型风险分类（可选） */
  riskClassifier?: AgentGateRiskClassifier
}

export type EvaluatePolicyInput = {
  sessionId: string
  action: string
  resources?: AgentGateResourceRef[]
  metadata?: Record<string, unknown>
  profileId?: AgentGateProfileId
  preview?: AgentGatePreview
}
