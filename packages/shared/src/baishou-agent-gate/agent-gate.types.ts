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

/** Resource kinds that permission patterns can target */
export type AgentGateResourceKind =
  | 'file_path'
  | 'workspace_path'
  | 'external_path'
  | 'shell_command'

export interface AgentGateResourceRef {
  kind: AgentGateResourceKind
  value: string
}

export interface AgentGatePermissionRule {
  action: string
  pattern?: string
  effect: AgentGateEffect
}

export interface BaishouAgentGateConfig {
  trustMode: AgentGateTrustMode
  exclusionList: string[]
  allowlist: AgentGateAllowlistEntry[]
  actionRules?: Partial<Record<string, AgentGateEffect>>
  /** Explicit wildcard rules; actionRules are derived into rules at evaluation time */
  permissionRules?: AgentGatePermissionRule[]
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
  /** Optional resource targets for pattern-based rules */
  resources?: AgentGateResourceRef[]
  /** Gate request metadata (forceExclusion, legacy path fields, etc.) */
  metadata?: Record<string, unknown>
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
  /** Structured resource targets; derived from metadata when omitted */
  resources?: AgentGateResourceRef[]
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
  buildResources?: (args: unknown, ctx: unknown) => AgentGateResourceRef[]
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
