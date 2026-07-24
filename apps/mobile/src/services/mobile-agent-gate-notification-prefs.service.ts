import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  DEFAULT_AGENT_GATE_NOTIFICATION_PREFS,
  normalizeAgentGateNotificationPrefs,
  type AgentGateNotificationPrefs
} from '@baishou/shared'

const STORAGE_KEY = 'baishou.device.agent_gate_notification_prefs'

let cached: AgentGateNotificationPrefs | null = null

export async function getMobileAgentGateNotificationPrefs(): Promise<AgentGateNotificationPrefs> {
  if (cached) return cached
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    cached = normalizeAgentGateNotificationPrefs(raw ? JSON.parse(raw) : null)
    return cached
  } catch {
    cached = { ...DEFAULT_AGENT_GATE_NOTIFICATION_PREFS }
    return cached
  }
}

export async function setMobileAgentGateNotificationPrefs(
  patch: Partial<AgentGateNotificationPrefs>
): Promise<AgentGateNotificationPrefs> {
  const current = await getMobileAgentGateNotificationPrefs()
  const next = normalizeAgentGateNotificationPrefs({ ...current, ...patch })
  cached = next
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
