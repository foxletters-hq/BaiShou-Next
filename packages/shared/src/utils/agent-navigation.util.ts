import {
  DEFAULT_LATTE_ASSISTANT_ID,
  SYSTEM_LATTE_ASSISTANT_ID
} from '../constants/latte-default-assistant.constants'
import type { AgentNavigationSnapshot } from '../types/agent-navigation.types'

function normalizeNavigationAssistantId(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() || null
  if (!trimmed) return null
  return trimmed === DEFAULT_LATTE_ASSISTANT_ID ? SYSTEM_LATTE_ASSISTANT_ID : trimmed
}

/** 根据上次伙伴/会话构建桌面端聊天路由 */
export function buildAgentChatNavigationPath(snapshot: AgentNavigationSnapshot): string {
  const assistantId = normalizeNavigationAssistantId(snapshot.assistantId)
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
  const assistantId =
    typeof data.assistantId === 'string' ? normalizeNavigationAssistantId(data.assistantId) : null
  const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() || null : null
  if (!assistantId && !sessionId) return null
  return { assistantId, sessionId }
}

/** 侧栏/返回伙伴页：按「返回后继续上次会话」决定是否带上 sessionId */
export function resolveCompanionReturnPath(input: {
  restoreLastSessionOnReturn: boolean
  snapshot: AgentNavigationSnapshot | null
}): string {
  if (!input.snapshot) return '/chat'
  if (input.restoreLastSessionOnReturn) {
    return buildAgentChatNavigationPath(input.snapshot)
  }
  return buildAgentChatNavigationPath({
    assistantId: input.snapshot.assistantId,
    sessionId: null
  })
}
