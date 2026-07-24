import { useAgentGateInboxStore } from '@baishou/store'
import type { AgentGateRequest } from '@baishou/shared'

let bridgeStarted = false
let unsubscribeAsked: (() => void) | null = null
let unsubscribeReplied: (() => void) | null = null

async function hydrateFromMain(): Promise<void> {
  const listPending = window.api?.agentGate?.listPending
  if (!listPending) {
    // API 未就绪时保留本地队列，避免误清空
    return
  }
  const snapshotIdsAtFetchStart = new Set(
    useAgentGateInboxStore.getState().pending.map((item) => item.id)
  )
  try {
    const pending = await listPending()
    useAgentGateInboxStore.getState().hydrate(Array.isArray(pending) ? pending : [], {
      snapshotIdsAtFetchStart
    })
  } catch {
    // 拉取失败时保留现有 pending，避免卡片消失但工具仍阻塞
  }
}

/**
 * 先订阅 asked/replied，再补拉 pending，避免 list 与订阅之间的空窗丢事件。
 */
export function ensureDesktopAgentGateInboxBridge(): void {
  if (bridgeStarted) return
  if (typeof window === 'undefined' || !window.api?.agentGate) return
  bridgeStarted = true

  unsubscribeAsked =
    window.api.agentGate.onAsked?.((request: AgentGateRequest) => {
      if (!request?.id) return
      useAgentGateInboxStore.getState().upsertAsked(request)
    }) ?? null

  unsubscribeReplied =
    window.api.agentGate.onReplied?.((payload) => {
      if (!payload?.requestId) return
      useAgentGateInboxStore.getState().removeReplied(payload.requestId)
    }) ?? null

  void hydrateFromMain()
}

export function disposeDesktopAgentGateInboxBridge(): void {
  unsubscribeAsked?.()
  unsubscribeReplied?.()
  unsubscribeAsked = null
  unsubscribeReplied = null
  bridgeStarted = false
}

export async function refreshDesktopAgentGateInbox(): Promise<void> {
  await hydrateFromMain()
}
