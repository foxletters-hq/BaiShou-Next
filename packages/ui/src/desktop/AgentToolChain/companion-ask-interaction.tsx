import React, { createContext, useContext, useMemo } from 'react'
import type { AgentGateRequest } from '@baishou/shared'
import type { AgentGateReplyPayload } from '../../agent-gate'

export interface CompanionAskInteractionValue {
  pending: AgentGateRequest | null
  isReplying: boolean
  onReply: (payload: AgentGateReplyPayload) => void | Promise<void>
}

const CompanionAskInteractionContext = createContext<CompanionAskInteractionValue | null>(null)

export function CompanionAskInteractionProvider({
  pending,
  isReplying = false,
  onReply,
  children
}: CompanionAskInteractionValue & { children: React.ReactNode }) {
  const value = useMemo(
    () => ({
      pending,
      isReplying,
      onReply
    }),
    [isReplying, onReply, pending]
  )

  return (
    <CompanionAskInteractionContext.Provider value={value}>
      {children}
    </CompanionAskInteractionContext.Provider>
  )
}

export function useCompanionAskInteraction(): CompanionAskInteractionValue | null {
  return useContext(CompanionAskInteractionContext)
}
