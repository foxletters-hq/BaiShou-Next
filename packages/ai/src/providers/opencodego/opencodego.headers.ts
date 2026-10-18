import { sanitizeRequestInit } from '../fetch-header.util'

/** OpenCode Go 要求客户端使用自有 UA，而不是通用 SDK / HTTP 库名称。 */
export const OPENCODE_GO_USER_AGENT = 'baishou-agent/1.0'

/** 官方要求的稳定会话头，用于路由与 prompt cache。 */
export const OPENCODE_GO_SESSION_HEADER = 'x-opencode-session'

export const OPENCODE_GO_MODELS_SESSION_ID = 'baishou-models-catalog'
export const OPENCODE_GO_CONNECTION_TEST_SESSION_ID = 'baishou-connection-test'

function createFallbackSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `baishou-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function resolveOpenCodeGoSessionId(sessionId?: string): string {
  const trimmed = sessionId?.trim()
  return trimmed || createFallbackSessionId()
}

export function withOpenCodeGoHeaders(
  init: RequestInit | undefined,
  sessionId: string
): RequestInit {
  const headers = new Headers(init?.headers ?? undefined)
  headers.set('User-Agent', OPENCODE_GO_USER_AGENT)
  headers.set(OPENCODE_GO_SESSION_HEADER, sessionId)
  return sanitizeRequestInit({ ...init, headers }) ?? { headers }
}
