import type { AgentNavigationSnapshot } from '@baishou/shared'
import { createStore } from '../create-store'

type VaultNavigationMap = Record<string, AgentNavigationSnapshot>

export interface AgentNavigationState {
  contexts: VaultNavigationMap
}

export interface AgentNavigationActions {
  getContext: (vaultKey: string) => AgentNavigationSnapshot
  setContext: (vaultKey: string, snapshot: AgentNavigationSnapshot) => void
  clearContext: (vaultKey: string) => void
}

const EMPTY_SNAPSHOT: AgentNavigationSnapshot = {
  assistantId: null,
  sessionId: null
}

export const useAgentNavigationStore = createStore<AgentNavigationState & AgentNavigationActions>(
  'AgentNavigationStore',
  (set, get) => ({
    contexts: {},

    getContext: (vaultKey) => get().contexts[vaultKey] ?? EMPTY_SNAPSHOT,

    setContext: (vaultKey, snapshot) =>
      set((state: AgentNavigationState & AgentNavigationActions) => ({
        contexts: {
          ...state.contexts,
          [vaultKey]: {
            assistantId: snapshot.assistantId ?? null,
            sessionId: snapshot.sessionId ?? null
          }
        }
      })),

    clearContext: (vaultKey) =>
      set((state: AgentNavigationState & AgentNavigationActions) => {
        if (!state.contexts[vaultKey]) return state
        const next = { ...state.contexts }
        delete next[vaultKey]
        return { contexts: next }
      })
  })
)
