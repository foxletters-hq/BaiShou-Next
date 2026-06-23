import type {
  AgentGateEffect,
  AgentGateKind,
  AgentGateReply,
  AgentGateRequestStatus,
  AgentGateRiskLevel,
  AgentGateTrustMode
} from './agent-gate.enums'

export interface AgentGateOption {
  id: string
  label: string
  description?: string
}

export interface AgentGateAllowlistEntry {
  id: string
  action: string
  createdAt: number
  sourceSessionId?: string
  sourceRequestId?: string
}

export interface BaishouAgentGateConfig {
  trustMode: AgentGateTrustMode
  exclusionList: string[]
  allowlist: AgentGateAllowlistEntry[]
  actionRules?: Partial<Record<string, AgentGateEffect>>
}

export interface AgentGateRequest {
  id: string
  sessionId: string
  vaultName: string
  status: AgentGateRequestStatus
  kind: AgentGateKind
  action: string
  title: string
  description?: string
  options: AgentGateOption[]
  allowCustomInput: boolean
  metadata: Record<string, unknown>
  messageId?: string
  toolCallId?: string
  createdAt: number
  resolvedAt?: number
}

export interface AgentGateReplyInput {
  requestId: string
  reply: AgentGateReply
  message?: string
  selectedOptionIds?: string[]
}

export interface AgentGateResolution {
  requestId: string
  reply: AgentGateReply
  selectedOptionIds?: string[]
  message?: string
  resolvedAt: number
}

export interface AgentGateEvaluateInput {
  action: string
  toolDisabled?: boolean
}

export interface AgentGateAssertInput {
  sessionId: string
  vaultName: string
  kind: AgentGateKind
  action: string
  title: string
  description?: string
  options?: AgentGateOption[]
  allowCustomInput?: boolean
  metadata?: Record<string, unknown>
  messageId?: string
  toolCallId?: string
}

export interface AgentGatePartData {
  request: AgentGateRequest
  resolution?: AgentGateResolution
}

export interface AgentGateToolMetadata {
  action?: string
  riskLevel: AgentGateRiskLevel
  forceExclusion?: boolean
  buildTitle?: (args: unknown, ctx: unknown) => string
  buildMetadata?: (args: unknown, ctx: unknown) => Record<string, unknown>
}

export interface AgentGateAskedEvent {
  type: 'agent_gate.asked'
  request: AgentGateRequest
}

export interface AgentGateRepliedEvent {
  type: 'agent_gate.replied'
  sessionId: string
  requestId: string
  reply: AgentGateReply
  message?: string
  selectedOptionIds?: string[]
}

export interface AgentGateAllowlistChangedEvent {
  type: 'agent_gate.allowlist_changed'
  allowlist: AgentGateAllowlistEntry[]
}

export type AgentGateEvent =
  | AgentGateAskedEvent
  | AgentGateRepliedEvent
  | AgentGateAllowlistChangedEvent

export interface AgentGateLifecycleContext {
  sessionId: string
  vaultName: string
}
