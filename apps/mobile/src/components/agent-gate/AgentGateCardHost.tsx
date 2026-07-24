import React, { useCallback } from 'react'
import { AgentGateReply, type AgentGateRequest } from '@baishou/shared'
import {
  selectQueuePosition,
  selectSameActionCountInSession,
  useAgentGateInboxStore
} from '@baishou/store'
import { AgentGateCard, type AgentGateReplyPayload } from '@baishou/ui/native'

export interface AgentGateCardHostProps {
  request: AgentGateRequest | null
  isReplying?: boolean
  onReply: (
    requestId: string,
    reply: AgentGateReply,
    extras?: Omit<AgentGateReplyPayload, 'requestId' | 'reply'>
  ) => Promise<void>
}

export const AgentGateCardHost: React.FC<AgentGateCardHostProps> = ({
  request,
  isReplying = false,
  onReply
}) => {
  const gateQueueIndex = useAgentGateInboxStore(
    (state) => selectQueuePosition(state, request?.sessionId, request?.id).index
  )
  const gateQueueTotal = useAgentGateInboxStore(
    (state) => selectQueuePosition(state, request?.sessionId, request?.id).total
  )
  const sameActionCount = useAgentGateInboxStore((state) =>
    selectSameActionCountInSession(state, request?.sessionId, request?.action)
  )

  const handleReply = useCallback(
    async (input: AgentGateReplyPayload) => {
      const { requestId, reply, ...extras } = input
      await onReply(requestId, reply, extras)
    },
    [onReply]
  )

  return (
    <AgentGateCard
      request={request}
      isReplying={isReplying}
      onReply={handleReply}
      queueIndex={gateQueueIndex}
      queueTotal={gateQueueTotal}
      sameActionCount={sameActionCount}
    />
  )
}
