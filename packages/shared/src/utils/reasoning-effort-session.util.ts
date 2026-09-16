import { normalizeReasoningEffortSetting, type ReasoningEffortSetting } from './reasoning-effort'

export const REASONING_EFFORT_SESSION_KEY = 'baishou.reasoningEffort.sessionOverride'
export const REASONING_EFFORT_BY_MODEL_KEY = 'baishou.reasoningEffort.byModel.v1'

export function reasoningEffortModelKey(providerId: string, modelId: string): string {
  return `${providerId.trim()}::${modelId.trim()}`
}

export function parseReasoningEffortMap(raw: string | null): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, string>
  } catch {
    return {}
  }
}

export function resolveReasoningEffortFromMap(
  map: Record<string, string>,
  providerId?: string | null,
  modelId?: string | null
): ReasoningEffortSetting {
  if (!providerId?.trim() || !modelId?.trim()) return 'auto'
  return normalizeReasoningEffortSetting(map[reasoningEffortModelKey(providerId, modelId)])
}

export function nextReasoningEffortMap(
  map: Record<string, string>,
  providerId: string,
  modelId: string,
  value: ReasoningEffortSetting
): Record<string, string> {
  const key = reasoningEffortModelKey(providerId, modelId)
  const next = { ...map }
  const normalized = normalizeReasoningEffortSetting(value)
  if (normalized === 'auto') delete next[key]
  else next[key] = normalized
  return next
}

export function resolveSessionReasoningEffort(raw: string | null): ReasoningEffortSetting | undefined {
  if (!raw) return undefined
  return normalizeReasoningEffortSetting(raw)
}

/** 会话选了具体档时覆盖设置默认；auto 仍走设置项 */
export function applySessionReasoningEffort<T extends Record<string, unknown>>(
  userConfig: T,
  reasoningEffort?: string | null
): T {
  if (typeof reasoningEffort === 'string' && reasoningEffort && reasoningEffort !== 'auto') {
    return { ...userConfig, reasoningEffort } as T
  }
  return userConfig
}
