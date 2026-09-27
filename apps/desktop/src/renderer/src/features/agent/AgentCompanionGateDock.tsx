import React from 'react'
import { AgentGateDock, toast } from '@baishou/ui'
import { useAgentGateInboxStore } from '@baishou/store'
import {
  isLocalCompanionAskRequestId,
  waitForLiveCompanionAskRequest
} from './utils/running-companion-ask-request.util'

type FlowGate = {
  sessionId?: string
  t: (key: string, fallback: string) => string
  stream: {
    isAgentGateReplying: boolean
    replyAgentGate: (payload: { requestId: string } & Record<string, unknown>) => Promise<void>
    timeline: unknown
  }
  scroll: { scrollToBottom: () => void }
}

export function AgentCompanionGateDock({
  flow,
  dockRequest,
  gateQueueIndex,
  gateQueueTotal,
  onQueuePrev,
  onQueueNext,
  sameActionCount
}: {
  flow: FlowGate
  dockRequest: React.ComponentProps<typeof AgentGateDock>['request']
  gateQueueIndex: number
  gateQueueTotal: number
  onQueuePrev: () => void
  onQueueNext: () => void
  sameActionCount: number
}) {
  return (
    <AgentGateDock
      request={dockRequest}
      isReplying={flow.stream.isAgentGateReplying}
      onReply={async (payload) => {
        let requestId = payload.requestId
        if (isLocalCompanionAskRequestId(requestId)) {
          const live = flow.sessionId
            ? await waitForLiveCompanionAskRequest({
                sessionId: flow.sessionId,
                listPending: (sessionId) => window.api.agentGate.listPending(sessionId),
                readInbox: () => useAgentGateInboxStore.getState().pending
              })
            : undefined
          if (!live) {
            toast.showError(flow.t('agent_gate.ask_not_ready', '确认卡还没连上，请再点一次'))
            return
          }
          requestId = live.id
        }
        await flow.stream.replyAgentGate({ ...payload, requestId })
        flow.scroll.scrollToBottom()
      }}
      queueIndex={gateQueueIndex}
      queueTotal={gateQueueTotal}
      onQueuePrev={onQueuePrev}
      onQueueNext={onQueueNext}
      sameActionCount={sameActionCount}
      placement="inline"
    />
  )
}
