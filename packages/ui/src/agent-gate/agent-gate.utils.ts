import {
  AgentGateKind,
  canPermanentlyAllowAgentGateAction,
  extractAgentGateResourcesFromMetadata,
  resolveCommandPrefixPatternFromCommand,
  type AgentGateReply,
  type AgentGateRequest,
  type AgentGateResourceRef
} from '@baishou/shared'

export interface AgentGateReplyPayload {
  requestId: string
  reply: AgentGateReply
  message?: string
  selectedOptionIds?: string[]
}

export function resolveRequestGateResources(request: AgentGateRequest): AgentGateResourceRef[] {
  return extractAgentGateResourcesFromMetadata(request.metadata)
}

export function canAlwaysAllowForRequest(request: AgentGateRequest): boolean {
  if (request.kind !== AgentGateKind.Tool) return false
  const resources = resolveRequestGateResources(request)
  return canPermanentlyAllowAgentGateAction(request.action, {
    metadata: request.metadata,
    resources
  })
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

/**
 * Prefix pattern that Always will persist for workspace_run.
 * Null when not applicable or command cannot be permanently allowed.
 */
export function resolveAlwaysAllowPrefixHint(request: AgentGateRequest): string | null {
  if (request.action !== 'workspace_run') return null
  const shell = resolveRequestGateResources(request).find((r) => r.kind === 'shell_command')
  if (!shell) return null
  return resolveCommandPrefixPatternFromCommand(shell.value)
}

export function formatAgentGateActionLabel(action: string): string {
  return action
}
