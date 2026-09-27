import React, { useCallback } from 'react'
import { AgentGateReply, type AgentGateRequest } from '@baishou/shared'
import {
  selectQueueNeighborId,
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
    (state) => selectQueuePosition(state, request?.sessionId, request?.id, 'companion').index
  )
  const gateQueueTotal = useAgentGateInboxStore(
    (state) => selectQueuePosition(state, request?.sessionId, request?.id, 'companion').total
  )
  const sameActionCount = useAgentGateInboxStore((state) =>
    selectSameActionCountInSession(state, request?.sessionId, request?.action, 'companion')
  )

  const flipQueue = useCallback(
    (delta: -1 | 1) => {
      if (!request) return
      const nextId = selectQueueNeighborId(
        useAgentGateInboxStore.getState(),
        request.sessionId,
        request.id,
        delta,
        'companion'
      )
      if (nextId) {
        useAgentGateInboxStore.getState().setFocusedRequest(request.sessionId, nextId)
      }
    },
    [request]
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
      onQueuePrev={() => flipQueue(-1)}
      onQueueNext={() => flipQueue(1)}
    />
  )
}
