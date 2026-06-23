import {
  AgentGateKind,
  DEFAULT_AGENT_GATE_EXCLUSION_LIST,
  type AgentGateReply,
  type AgentGateRequest
} from '@baishou/shared'

export interface AgentGateReplyPayload {
  requestId: string
  reply: AgentGateReply
  message?: string
  selectedOptionIds?: string[]
}

export function canAlwaysAllowForRequest(request: AgentGateRequest): boolean {
  if (request.kind !== AgentGateKind.Tool) return false
  if (request.metadata?.forceExclusion === true) return false
  return !DEFAULT_AGENT_GATE_EXCLUSION_LIST.includes(
    request.action as (typeof DEFAULT_AGENT_GATE_EXCLUSION_LIST)[number]
  )
}

export function shouldShowProactiveOptions(request: AgentGateRequest): boolean {
  return request.kind === AgentGateKind.Proactive && request.options.length > 0
}

export function shouldShowAlwaysAllow(request: AgentGateRequest): boolean {
  return request.kind === AgentGateKind.Tool && canAlwaysAllowForRequest(request)
}

export function shouldShowCustomRejectInput(request: AgentGateRequest): boolean {
  return request.allowCustomInput === true
}

export function formatAgentGateActionLabel(action: string): string {
  return action
}
