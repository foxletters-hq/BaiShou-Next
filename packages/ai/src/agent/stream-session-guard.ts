interface SessionStreamClaim {
  generation: number
  abortController: AbortController
}

const sessionClaims = new Map<string, SessionStreamClaim>()
/** 在 claim 之前收到的 stop：下一次 claim 立即 aborted，避免配置阶段取消落空 */
const pendingStopSessionIds = new Set<string>()
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
  if (pendingStopSessionIds.has(sessionId)) {
    pendingStopSessionIds.delete(sessionId)
    abortController.abort()
  }
  sessionClaims.set(sessionId, { generation, abortController })

  return {
    generation,
    signal: abortController.signal,
    abort: () => abortController.abort()
  }
}

export function isAgentStreamSessionClaimActive(sessionId: string, generation: number): boolean {
  return sessionClaims.get(sessionId)?.generation === generation
}

export function releaseAgentStreamSession(sessionId: string, generation: number): void {
  const claim = sessionClaims.get(sessionId)
  if (claim?.generation === generation) {
    sessionClaims.delete(sessionId)
  }
}

export function abortAgentStreamSession(sessionId: string): void {
  const claim = sessionClaims.get(sessionId)
  if (claim) {
    claim.abortController.abort()
    return
  }
  // claim 尚未建立（如仍在 buildStreamConfig）：登记 pending，待 claim 时立即 abort
  pendingStopSessionIds.add(sessionId)
}

export function abortAllAgentStreamSessions(): void {
  for (const claim of sessionClaims.values()) {
    claim.abortController.abort()
  }
  pendingStopSessionIds.clear()
}

/** 测试专用：重置全局状态 */
export function resetAgentStreamSessionGuardForTests(): void {
  abortAllAgentStreamSessions()
  pendingStopSessionIds.clear()
  nextGeneration = 0
}
