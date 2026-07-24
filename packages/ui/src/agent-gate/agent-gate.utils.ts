import {
  AgentGateKind,
  canPermanentlyAllowAgentGateAction,
  extractAgentGateResourcesFromMetadata,
  resolveCommandPrefixPatternFromCommand,
  shouldDisableAlwaysForPreview,
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
  if (request.kind !== AgentGateKind.Tool) return false
  if (shouldDisableAlwaysForPreview(request.preview)) return false
  return canAlwaysAllowForRequest(request)
}

export function resolveAlwaysDisabledReason(request: AgentGateRequest): string | null {
  if (request.kind !== AgentGateKind.Tool) return null
  if (shouldDisableAlwaysForPreview(request.preview)) {
    if (request.preview?.type === 'file_change' && request.preview.truncated) {
      return '预览已截断，仅可本次允许'
    }
    if (request.preview?.type === 'command' && request.preview.dangerous) {
      return '危险命令不可始终允许'
    }
    return '当前预览不完整，仅可本次允许'
  }
  if (!canAlwaysAllowForRequest(request)) {
    return '此操作不可始终允许'
  }
  return null
}

export function shouldShowCustomRejectInput(request: AgentGateRequest): boolean {
  return request.allowCustomInput === true
}

/**
 * Pattern that Always will persist (command prefix or exact path).
 * Null when not applicable or cannot be permanently allowed.
 */
export function resolveAlwaysAllowPrefixHint(request: AgentGateRequest): string | null {
  if (!shouldShowAlwaysAllow(request)) return null
  const resources = resolveRequestGateResources(request)
  if (request.action === 'workspace_run') {
    const shell = resources.find((r) => r.kind === 'shell_command')
    if (!shell) return null
    return resolveCommandPrefixPatternFromCommand(shell.value)
  }
  const path = resources.find((r) => r.kind === 'workspace_path' || r.kind === 'file_path')
  return path ? path.value.replace(/\\/g, '/') : null
}

export function formatAgentGateActionLabel(action: string): string {
  return action
}
