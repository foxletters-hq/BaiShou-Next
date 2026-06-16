const AGENT_NAVIGATION_STORAGE_PREFIX = 'baishou_agent_nav:'

export function agentNavigationStorageKey(vaultKey: string): string {
  return `${AGENT_NAVIGATION_STORAGE_PREFIX}${vaultKey}`
}
