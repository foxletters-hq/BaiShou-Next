import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  agentNavigationStorageKey,
  parseAgentNavigationSnapshot,
  type AgentNavigationSnapshot
} from '@baishou/shared'

export async function readAgentNavigationSnapshot(
  vaultKey: string
): Promise<AgentNavigationSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(agentNavigationStorageKey(vaultKey))
    if (!raw) return null
    return parseAgentNavigationSnapshot(JSON.parse(raw))
  } catch {
    return null
  }
}

export async function writeAgentNavigationSnapshot(
  vaultKey: string,
  snapshot: AgentNavigationSnapshot
): Promise<void> {
  if (!snapshot.assistantId && !snapshot.sessionId) {
    await AsyncStorage.removeItem(agentNavigationStorageKey(vaultKey)).catch(() => {})
    return
  }
  await AsyncStorage.setItem(agentNavigationStorageKey(vaultKey), JSON.stringify(snapshot)).catch(
    () => {}
  )
}
