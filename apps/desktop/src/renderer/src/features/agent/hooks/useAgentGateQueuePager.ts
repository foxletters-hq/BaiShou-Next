import { useCallback } from 'react'
import type { AgentGateSurface } from '@baishou/shared'
import { selectQueueNeighborId, selectQueuePosition, useAgentGateInboxStore } from '@baishou/store'

export function useAgentGateQueuePager(
  sessionId: string | undefined,
  requestId: string | undefined,
  surface: AgentGateSurface = 'companion'
) {
  const queueIndex = useAgentGateInboxStore(
    (state) => selectQueuePosition(state, sessionId, requestId, surface).index
  )
  const queueTotal = useAgentGateInboxStore(
    (state) => selectQueuePosition(state, sessionId, requestId, surface).total
  )

  const flip = useCallback(
    (delta: -1 | 1) => {
      if (!sessionId || !requestId) return
      const nextId = selectQueueNeighborId(
        useAgentGateInboxStore.getState(),
        sessionId,
        requestId,
        delta,
        surface
      )
      if (nextId) {
        useAgentGateInboxStore.getState().setFocusedRequest(sessionId, nextId)
      }
    },
    [requestId, sessionId, surface]
  )

  const onQueuePrev = useCallback(() => flip(-1), [flip])
  const onQueueNext = useCallback(() => flip(1), [flip])

  return { queueIndex, queueTotal, onQueuePrev, onQueueNext }
}
