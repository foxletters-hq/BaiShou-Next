import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  applySessionReasoningEffort,
  nextReasoningEffortMap,
  parseReasoningEffortMap,
  REASONING_EFFORT_BY_MODEL_KEY,
  resolveReasoningEffortFromMap,
  resolveSessionReasoningEffort,
  type ReasoningEffortSetting
} from '@baishou/shared'

const SESSION_MAP_KEY = 'baishou.reasoningEffort.bySession.v1'

let memoryOverride: ReasoningEffortSetting = 'auto'

export function getMobileSessionReasoningEffort(): ReasoningEffortSetting {
  return memoryOverride
}

export function peekMobileSessionReasoningEffort(): ReasoningEffortSetting {
  return memoryOverride
}

export async function loadMobileSessionReasoningEffort(
  sessionId: string | null,
  providerId?: string | null,
  modelId?: string | null
): Promise<ReasoningEffortSetting> {
  if (sessionId) {
    const map = parseReasoningEffortMap(await AsyncStorage.getItem(SESSION_MAP_KEY))
    const fromSession = resolveSessionReasoningEffort(map[sessionId] ?? null)
    if (fromSession && fromSession !== 'auto') {
      memoryOverride = fromSession
      return memoryOverride
    }
  }
  const byModel = parseReasoningEffortMap(await AsyncStorage.getItem(REASONING_EFFORT_BY_MODEL_KEY))
  memoryOverride = resolveReasoningEffortFromMap(byModel, providerId, modelId)
  return memoryOverride
}

export async function saveMobileSessionReasoningEffort(
  sessionId: string | null,
  providerId: string | null | undefined,
  modelId: string | null | undefined,
  value: ReasoningEffortSetting
): Promise<void> {
  memoryOverride = value
  if (sessionId) {
    const map = parseReasoningEffortMap(await AsyncStorage.getItem(SESSION_MAP_KEY))
    const next = { ...map }
    if (value === 'auto') delete next[sessionId]
    else next[sessionId] = value
    await AsyncStorage.setItem(SESSION_MAP_KEY, JSON.stringify(next))
  }
  if (providerId && modelId) {
    const map = parseReasoningEffortMap(await AsyncStorage.getItem(REASONING_EFFORT_BY_MODEL_KEY))
    await AsyncStorage.setItem(
      REASONING_EFFORT_BY_MODEL_KEY,
      JSON.stringify(nextReasoningEffortMap(map, providerId, modelId, value))
    )
  }
}

export function applyMobileSessionReasoningEffort<T extends Record<string, unknown>>(
  userConfig: T,
  override?: string | null
): T {
  return applySessionReasoningEffort(userConfig, override ?? memoryOverride)
}
