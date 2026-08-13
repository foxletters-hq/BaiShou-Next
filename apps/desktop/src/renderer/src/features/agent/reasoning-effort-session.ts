import type { ReasoningEffortSetting } from '@baishou/shared'
import { normalizeReasoningEffortSetting } from '@baishou/shared'

/** 当前生效的思考档位（发送请求时读取） */
const ACTIVE_EFFORT_KEY = 'baishou.reasoningEffort.sessionOverride'
/** 按供应商+模型记忆的思考档位（本机持久化） */
const BY_MODEL_EFFORT_KEY = 'baishou.reasoningEffort.byModel.v1'

export function reasoningEffortModelKey(providerId: string, modelId: string): string {
  return `${providerId.trim()}::${modelId.trim()}`
}

function readJsonMap(storageKey: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, string>
  } catch {
    return {}
  }
}

function writeJsonMap(storageKey: string, map: Record<string, string>): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(map))
  } catch {
    // ignore
  }
}

/** 读取某模型记忆的思考档位；无记录则为 auto */
export function getReasoningEffortForModel(
  providerId?: string | null,
  modelId?: string | null
): ReasoningEffortSetting {
  if (!providerId?.trim() || !modelId?.trim()) return 'auto'
  const map = readJsonMap(BY_MODEL_EFFORT_KEY)
  return normalizeReasoningEffortSetting(map[reasoningEffortModelKey(providerId, modelId)])
}

/** 写入某模型的思考档位；auto 则清除该键 */
export function setReasoningEffortForModel(
  providerId: string,
  modelId: string,
  value: ReasoningEffortSetting
): void {
  if (!providerId?.trim() || !modelId?.trim()) return
  const key = reasoningEffortModelKey(providerId, modelId)
  const map = readJsonMap(BY_MODEL_EFFORT_KEY)
  const normalized = normalizeReasoningEffortSetting(value)
  if (normalized === 'auto') {
    if (!(key in map)) return
    delete map[key]
  } else {
    map[key] = normalized
  }
  writeJsonMap(BY_MODEL_EFFORT_KEY, map)
}

/** 当前会话生效的思考档位 */
export function getSessionReasoningEffortOverride(): ReasoningEffortSetting | undefined {
  try {
    const raw = sessionStorage.getItem(ACTIVE_EFFORT_KEY)
    if (!raw) return undefined
    return normalizeReasoningEffortSetting(raw)
  } catch {
    return undefined
  }
}

export function setSessionReasoningEffortOverride(value: ReasoningEffortSetting): void {
  try {
    if (value === 'auto') {
      sessionStorage.removeItem(ACTIVE_EFFORT_KEY)
    } else {
      sessionStorage.setItem(ACTIVE_EFFORT_KEY, value)
    }
  } catch {
    // ignore
  }
}
