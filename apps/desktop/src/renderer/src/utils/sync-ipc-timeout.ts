/** 读注册表指纹等轻量 IPC */
export const SYNC_IPC_FAST_TIMEOUT_MS = 10_000
/** planSync / evaluatePlanDrift：含本地扫描与拉远端清单 */
export const SYNC_IPC_PLAN_TIMEOUT_MS = 60_000
/** orchestratedSync：连续无进度事件视为挂起 */
export const SYNC_IPC_PROGRESS_STALL_MS = 30_000
export const SYNC_IPC_MAX_RETRIES = 3

/** @deprecated 使用 SYNC_IPC_PLAN_TIMEOUT_MS */
export const SYNC_IPC_TIMEOUT_MS = SYNC_IPC_PLAN_TIMEOUT_MS

export class SyncIpcTimeoutError extends Error {
  readonly timeoutMs: number

  constructor(timeoutMs: number) {
    super(`SyncIpcTimeoutError:${timeoutMs}`)
    this.name = 'SyncIpcTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

export class SyncIpcStallError extends Error {
  readonly stallMs: number

  constructor(stallMs: number) {
    super(`SyncIpcStallError:${stallMs}`)
    this.name = 'SyncIpcStallError'
    this.stallMs = stallMs
  }
}

function raceWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new SyncIpcTimeoutError(timeoutMs))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export async function withSyncIpcTimeoutAndRetry<T>(
  run: () => Promise<T>,
  options?: {
    timeoutMs?: number
    maxRetries?: number
    onRetry?: (retryIndex: number, maxRetries: number) => void
  }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? SYNC_IPC_PLAN_TIMEOUT_MS
  const maxRetries = options?.maxRetries ?? SYNC_IPC_MAX_RETRIES
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await raceWithTimeout(run(), timeoutMs)
    } catch (error) {
      lastError = error
      if (attempt >= maxRetries) break
      options?.onRetry?.(attempt + 1, maxRetries)
    }
  }

  throw lastError
}

function startProgressStallWatch(
  lastBeatAt: () => number,
  stallMs: number
): { promise: Promise<never>; cancel: () => void } {
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const promise = new Promise<never>((_, reject) => {
    const tick = () => {
      if (cancelled) return
      if (Date.now() - lastBeatAt() >= stallMs) {
        reject(new SyncIpcStallError(stallMs))
        return
      }
      timer = setTimeout(tick, 1_000)
    }
    timer = setTimeout(tick, stallMs)
  })

  return {
    promise,
    cancel: () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }
}

/**
 * 正式同步专用：IPC 可能持续较久，仅在连续无 progress 事件时判定挂起并重试。
 */
export async function withSyncProgressStallAndRetry<T>(
  run: () => Promise<T>,
  listenProgress: (onBeat: () => void) => () => void,
  options?: {
    stallMs?: number
    maxRetries?: number
    onRetry?: (retryIndex: number, maxRetries: number) => void
  }
): Promise<T> {
  const stallMs = options?.stallMs ?? SYNC_IPC_PROGRESS_STALL_MS
  const maxRetries = options?.maxRetries ?? SYNC_IPC_MAX_RETRIES
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let lastBeatAt = Date.now()
    const unsub = listenProgress(() => {
      lastBeatAt = Date.now()
    })
    const watch = startProgressStallWatch(() => lastBeatAt, stallMs)

    try {
      return await Promise.race([run(), watch.promise])
    } catch (error) {
      lastError = error
      if (attempt >= maxRetries) break
      options?.onRetry?.(attempt + 1, maxRetries)
    } finally {
      watch.cancel()
      unsub()
    }
  }

  throw lastError
}
