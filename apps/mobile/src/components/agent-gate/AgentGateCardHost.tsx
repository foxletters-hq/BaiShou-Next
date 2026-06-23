import React, { useCallback } from 'react'
import { AgentGateReply, type AgentGateRequest } from '@baishou/shared'
import { AgentGateCard, type AgentGateReplyPayload } from '@baishou/ui/native'

export interface AgentGateCardHostProps {
  request: AgentGateRequest | null
  onReply: (requestId: string, reply: AgentGateReply, extras?: Omit<AgentGateReplyPayload, 'requestId' | 'reply'>) => Promise<void>
}

export const AgentGateCardHost: React.FC<AgentGateCardHostProps> = ({ request, onReply }) => {
  const handleReply = useCallback(
    async (input: AgentGateReplyPayload) => {
      const { requestId, reply, ...extras } = input
      await onReply(requestId, reply, extras)
    },
    [onReply]
  )

  return <AgentGateCard request={request} onReply={handleReply} />
}
