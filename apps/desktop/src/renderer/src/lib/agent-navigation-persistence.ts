import {
  agentNavigationStorageKey,
  parseAgentNavigationSnapshot,
  type AgentNavigationSnapshot
} from '@baishou/shared'

export function readAgentNavigationSnapshot(vaultKey: string): AgentNavigationSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(agentNavigationStorageKey(vaultKey))
    if (!raw) return null
    return parseAgentNavigationSnapshot(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeAgentNavigationSnapshot(
  vaultKey: string,
  snapshot: AgentNavigationSnapshot
): void {
  if (typeof window === 'undefined') return
  try {
    if (!snapshot.assistantId && !snapshot.sessionId) {
      window.localStorage.removeItem(agentNavigationStorageKey(vaultKey))
      return
    }
    window.localStorage.setItem(agentNavigationStorageKey(vaultKey), JSON.stringify(snapshot))
  } catch {
    // ignore quota / private mode
  }
}

export function readActiveVaultNavigationSnapshot(): AgentNavigationSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const activeVault = window.localStorage.getItem('baishou_active_vault') || 'default'
    return readAgentNavigationSnapshot(activeVault)
  } catch {
    return null
  }
}
