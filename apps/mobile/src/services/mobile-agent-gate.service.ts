import type { AgentGateLifecycleEvent, IBaishouAgentGate } from '@baishou/ai'
import { onAgentGateLifecycle } from '@baishou/ai'
import { useAgentGateInboxStore } from '@baishou/store'

export type MobileAgentGateListener = (event: AgentGateLifecycleEvent) => void

const listeners = new Set<MobileAgentGateListener>()
let unsubscribeCore: (() => void) | null = null
let inboxBridgeStarted = false
let getAgentGateRef: (() => IBaishouAgentGate | undefined) | null = null

function applyLifecycleToInbox(event: AgentGateLifecycleEvent): void {
  if (event.type === 'agent_gate.asked') {
    useAgentGateInboxStore.getState().upsertAsked(event.request)
    return
  }
  if (event.type === 'agent_gate.replied') {
    useAgentGateInboxStore.getState().removeReplied(event.requestId)
  }
}

/** 对齐 mobile-compression-event.service：桥接 @baishou/ai 门控生命周期到 RN 订阅方 */
export function ensureMobileAgentGateBridge(): void {
  if (unsubscribeCore) return
  unsubscribeCore = onAgentGateLifecycle((event) => {
    applyLifecycleToInbox(event)
    for (const listener of listeners) {
      try {
        listener(event)
      } catch {
        /* ignore */
      }
    }
  })
}

/**
 * 根级维护全局 pending 队列：先订阅生命周期，再 listPending 水合。
 */
export function ensureMobileAgentGateInboxBridge(
  getAgentGate: () => IBaishouAgentGate | undefined
): void {
  getAgentGateRef = getAgentGate
  ensureMobileAgentGateBridge()
  if (inboxBridgeStarted) return
  inboxBridgeStarted = true
  void hydrateMobileAgentGateInbox()
}

export async function hydrateMobileAgentGateInbox(): Promise<void> {
  const gate = getAgentGateRef?.()
  if (!gate?.listPending) {
    // Gate 未就绪时保留本地队列，避免误清空
    return
  }
  const snapshotIdsAtFetchStart = new Set(
    useAgentGateInboxStore.getState().pending.map((item) => item.id)
  )
  try {
    const pending = gate.listPending()
    useAgentGateInboxStore.getState().hydrate(Array.isArray(pending) ? pending : [], {
      snapshotIdsAtFetchStart
    })
  } catch {
    // 拉取失败时保留现有 pending
  }
}

export function listPendingMobileAgentGate(sessionId?: string) {
  const gate = getAgentGateRef?.()
  if (!gate?.listPending) return []
  return gate.listPending(sessionId)
}

export function subscribeMobileAgentGateEvents(listener: MobileAgentGateListener): () => void {
  ensureMobileAgentGateBridge()
  listeners.add(listener)
  return () => listeners.delete(listener)
}
