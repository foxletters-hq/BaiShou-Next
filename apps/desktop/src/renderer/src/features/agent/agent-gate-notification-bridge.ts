import { useAgentGateInboxStore } from '@baishou/store'
import type { AgentGateRequest } from '@baishou/shared'

let started = false

function currentSessionIdFromHash(): string | null {
  const hash = window.location.hash.replace(/^#/, '')
  const chatMatch = hash.match(/^\/chat\/([^/?#]+)/)
  if (chatMatch?.[1]) return decodeURIComponent(chatMatch[1])
  const wsMatch = hash.match(/^\/agent-workspace\/([^/?#]+)/)
  if (wsMatch?.[1]) return decodeURIComponent(wsMatch[1])
  return null
}

async function refreshInboxFromMain(): Promise<boolean> {
  const listPending = window.api?.agentGate?.listPending
  if (!listPending) return false
  const snapshotIdsAtFetchStart = new Set(
    useAgentGateInboxStore.getState().pending.map((item) => item.id)
  )
  try {
    const list = await listPending()
    useAgentGateInboxStore.getState().hydrate(Array.isArray(list) ? list : [], {
      snapshotIdsAtFetchStart
    })
    return true
  } catch {
    return false
  }
}

/**
 * 聚焦窗口时：若当前并非目标会话，强制发系统通知。
 * 点击通知：导航到对应会话并聚焦请求。
 */
export function ensureDesktopAgentGateNotificationBridge(): void {
  if (started) return
  if (typeof window === 'undefined' || !window.api?.agentGate) return
  started = true

  window.api.agentGate.onFocusCheck?.((request: AgentGateRequest) => {
    if (!request?.id || !request.sessionId) return
    const current = currentSessionIdFromHash()
    if (current === request.sessionId) return
    void window.api.agentGate.notifyAsked?.(request)
  })

  window.api.agentGate.onNavigate?.((payload) => {
    if (!payload?.sessionId || !payload.requestId) return
    void (async () => {
      const refreshed = await refreshInboxFromMain()
      const exists = useAgentGateInboxStore
        .getState()
        .pending.some((item) => item.id === payload.requestId)
      // 刷新失败时若本地仍有该项也可导航；刷新成功且已不存在则放弃
      if (!exists && refreshed) return
      if (!exists) return
      navigateToGateRequest(payload)
    })()
  })
}

function navigateToGateRequest(payload: {
  sessionId: string
  requestId: string
  scope?: { kind: string; workspaceId?: string }
}): void {
  useAgentGateInboxStore.getState().setFocusedRequest(payload.sessionId, payload.requestId)
  const path =
    payload.scope?.kind === 'workspace'
      ? `/agent-workspace/${payload.sessionId}`
      : `/chat/${payload.sessionId}`
  if (window.location.hash !== `#${path}`) {
    window.location.hash = path
  }
}
