import type { AgentNavigationSnapshot } from '../types/agent-navigation.types'

/** 根据上次伙伴/会话构建桌面端聊天路由 */
export function buildAgentChatNavigationPath(snapshot: AgentNavigationSnapshot): string {
  const assistantId = snapshot.assistantId?.trim() || null
  const sessionId = snapshot.sessionId?.trim() || null

  if (sessionId) {
    return assistantId
      ? `/chat/${encodeURIComponent(sessionId)}?assistantId=${encodeURIComponent(assistantId)}`
      : `/chat/${encodeURIComponent(sessionId)}`
  }

  if (assistantId) {
    return `/chat?assistantId=${encodeURIComponent(assistantId)}`
  }

  return '/chat'
}

export function parseAgentNavigationSnapshot(raw: unknown): AgentNavigationSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const assistantId = typeof data.assistantId === 'string' ? data.assistantId : null
  const sessionId = typeof data.sessionId === 'string' ? data.sessionId : null
  if (!assistantId && !sessionId) return null
  return { assistantId, sessionId }
}
