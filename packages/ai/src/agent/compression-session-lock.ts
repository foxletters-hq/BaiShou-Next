import { COMPRESSION_DEBOUNCE_MS } from './compression.constants'

const inFlight = new Map<string, Promise<boolean>>()
const lastCompletedAt = new Map<string, number>()

/**
 * 同一会话压缩串行化；短时间内的重复调用直接跳过（返回 false）。
 */
export async function runCompressionWithSessionLock(
  sessionId: string,
  fn: () => Promise<boolean>
): Promise<boolean> {
  const now = Date.now()
  const last = lastCompletedAt.get(sessionId) ?? 0
  if (now - last < COMPRESSION_DEBOUNCE_MS) {
    return false
  }

  const existing = inFlight.get(sessionId)
  if (existing) {
    return existing
  }

  const job = (async () => {
    try {
      return await fn()
    } finally {
      inFlight.delete(sessionId)
      lastCompletedAt.set(sessionId, Date.now())
    }
  })()

  inFlight.set(sessionId, job)
  return job
}

export function clearCompressionSessionLock(sessionId: string): void {
  inFlight.delete(sessionId)
  lastCompletedAt.delete(sessionId)
}

const recompressInFlight = new Map<string, Promise<unknown>>()

/** 重新压缩专用锁（返回 undefined 表示已有任务在跑） */
export async function runRecompressWithSessionLock<T>(
  sessionId: string,
  fn: () => Promise<T>
): Promise<T | undefined> {
  const existing = recompressInFlight.get(sessionId)
  if (existing) {
    await existing.catch(() => {})
    return undefined
  }
  const job = fn().finally(() => {
    if (recompressInFlight.get(sessionId) === job) {
      recompressInFlight.delete(sessionId)
    }
  })
  recompressInFlight.set(sessionId, job)
  return job
}
