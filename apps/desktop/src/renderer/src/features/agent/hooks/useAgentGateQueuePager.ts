import { useCallback } from 'react'
import { selectQueueNeighborId, selectQueuePosition, useAgentGateInboxStore } from '@baishou/store'

export function useAgentGateQueuePager(
  sessionId: string | undefined,
  requestId: string | undefined
) {
  const queueIndex = useAgentGateInboxStore(
    (state) => selectQueuePosition(state, sessionId, requestId).index
  )
  const queueTotal = useAgentGateInboxStore(
    (state) => selectQueuePosition(state, sessionId, requestId).total
  )

  const flip = useCallback(
    (delta: -1 | 1) => {
      if (!sessionId || !requestId) return
      const nextId = selectQueueNeighborId(
        useAgentGateInboxStore.getState(),
        sessionId,
        requestId,
        delta
      )
      if (nextId) {
        useAgentGateInboxStore.getState().setFocusedRequest(sessionId, nextId)
      }
    },
    [requestId, sessionId]
  )

  const onQueuePrev = useCallback(() => flip(-1), [flip])
  const onQueueNext = useCallback(() => flip(1), [flip])

  return { queueIndex, queueTotal, onQueuePrev, onQueueNext }
}
