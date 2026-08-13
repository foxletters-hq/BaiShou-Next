/**
 * 回滚前停流等待：轮询 isStreaming，超时后强制摘掉会话 streaming 标记，
 * 避免泄漏标记导致回滚永久卡住或误判仍在写盘。
 */
export async function waitForStreamIdleThenForceClear(deps: {
  sessionId: string
  isStreaming: (sessionId: string) => boolean
  forceClear: (sessionId: string) => void
  sleep?: (ms: number) => Promise<void>
  pollMs?: number
  maxWaitMs?: number
  onForceClear?: (sessionId: string) => void
}): Promise<{ forcedClear: boolean; waitedMs: number }> {
  const pollMs = deps.pollMs ?? 50
  const maxWaitMs = deps.maxWaitMs ?? 2000
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const started = Date.now()

  while (deps.isStreaming(deps.sessionId) && Date.now() - started < maxWaitMs) {
    await sleep(pollMs)
  }

  const waitedMs = Date.now() - started
  if (!deps.isStreaming(deps.sessionId)) {
    return { forcedClear: false, waitedMs }
  }

  deps.forceClear(deps.sessionId)
  deps.onForceClear?.(deps.sessionId)
  return { forcedClear: true, waitedMs }
}
