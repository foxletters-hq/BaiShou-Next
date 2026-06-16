interface SessionStreamClaim {
  generation: number
  abortController: AbortController
}

const sessionClaims = new Map<string, SessionStreamClaim>()
let nextGeneration = 0

export interface AgentStreamSessionClaim {
  generation: number
  signal: AbortSignal
  abort: () => void
}

/**
 * 声明会话级流式生成权：中止同会话旧流，返回新 claim。
 * 用于防止快速重试导致多条并行流各自落盘。
 */
export function claimAgentStreamSession(sessionId: string): AgentStreamSessionClaim {
  const generation = ++nextGeneration

  const prev = sessionClaims.get(sessionId)
  prev?.abortController.abort()

  const abortController = new AbortController()
  sessionClaims.set(sessionId, { generation, abortController })

  return {
    generation,
    signal: abortController.signal,
    abort: () => abortController.abort()
  }
}

export function isAgentStreamSessionClaimActive(
  sessionId: string,
  generation: number
): boolean {
  return sessionClaims.get(sessionId)?.generation === generation
}

export function releaseAgentStreamSession(sessionId: string, generation: number): void {
  const claim = sessionClaims.get(sessionId)
  if (claim?.generation === generation) {
    sessionClaims.delete(sessionId)
  }
}

export function abortAgentStreamSession(sessionId: string): void {
  sessionClaims.get(sessionId)?.abortController.abort()
}

export function abortAllAgentStreamSessions(): void {
  for (const claim of sessionClaims.values()) {
    claim.abortController.abort()
  }
}

/** 测试专用：重置全局状态 */
export function resetAgentStreamSessionGuardForTests(): void {
  abortAllAgentStreamSessions()
  nextGeneration = 0
}
