import {
  AgentGateKind,
  canPermanentlyAllowAgentGateAction,
  extractAgentGateResourcesFromMetadata,
  resolveCommandPrefixPatternFromCommand,
  shouldDisableAlwaysForPreview,
  type AgentGateDecisionSource,
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

function resolveAlwaysPatternsFromRequest(request: AgentGateRequest): string[] | undefined {
  const raw = request.metadata?.alwaysPatterns
  if (!Array.isArray(raw)) return undefined
  return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function canAlwaysAllowForRequest(request: AgentGateRequest): boolean {
  if (request.kind !== AgentGateKind.Tool) return false
  const resources = resolveRequestGateResources(request)
  return canPermanentlyAllowAgentGateAction(request.action, {
    metadata: request.metadata,
    resources,
    alwaysPatterns: resolveAlwaysPatternsFromRequest(request)
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
 * Pattern that Always will persist (tool-declared alwaysPatterns first).
 * Null when not applicable or cannot be permanently allowed.
 */
export function resolveAlwaysAllowPrefixHint(request: AgentGateRequest): string | null {
  if (!shouldShowAlwaysAllow(request)) return null
  const declared = resolveAlwaysPatternsFromRequest(request)
  if (declared && declared.length > 0) {
    return declared.join(', ')
  }
  const resources = resolveRequestGateResources(request)
  if (request.action === 'workspace_run') {
    const shell = resources.find((r) => r.kind === 'shell_command')
    if (!shell) return null
    return resolveCommandPrefixPatternFromCommand(shell.value)
  }
  if (request.action === 'external_directory') {
    const external = resources.find((r) => r.kind === 'external_path')
    return external ? external.value.replace(/\\/g, '/') : null
  }
  const path = resources.find((r) => r.kind === 'workspace_path' || r.kind === 'file_path')
  return path ? path.value.replace(/\\/g, '/') : null
}

export function resolveDecisionSource(request: AgentGateRequest): AgentGateDecisionSource | null {
  const raw = request.metadata?.decisionSource
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Partial<AgentGateDecisionSource>
  if (typeof source.action !== 'string' || typeof source.effect !== 'string') return null
  if (typeof source.layer !== 'string') return null
  return source as AgentGateDecisionSource
}

const LAYER_LABELS: Record<string, string> = {
  profile: '场景默认',
  user: '工作区规则',
  remembered: '已记住',
  session: '自动接受',
  default: '默认'
}

const EFFECT_LABELS: Record<string, string> = {
  allow: '允许',
  ask: '询问',
  deny: '拒绝'
}

/** 卡片来源说明一行，如：工作区规则「workspace_run → 询问」 */
export function formatDecisionSourceLine(request: AgentGateRequest): string | null {
  const source = resolveDecisionSource(request)
  if (!source) return null
  const layer = LAYER_LABELS[source.layer] ?? source.layer
  const effect = EFFECT_LABELS[source.effect] ?? source.effect
  const patternPart = source.pattern ? ` ${source.pattern}` : ''
  const clampHint = source.clampedFrom === 'allow' ? '（红线钳制）' : ''
  return `${layer}「${source.action}${patternPart} → ${effect}」${clampHint}`
}

export function formatAgentGateActionLabel(action: string): string {
  return action
}
