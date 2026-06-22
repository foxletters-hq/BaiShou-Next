/** 用户主动取消增量同步（UI 与 HTTP 一致中止） */
export class IncrementalSyncAbortedError extends Error {
  constructor(message = '增量同步已取消') {
    super(message)
    this.name = 'IncrementalSyncAbortedError'
  }
}

export function isIncrementalSyncAbortedError(error: unknown): boolean {
  if (error instanceof IncrementalSyncAbortedError) return true
  if (error instanceof Error && error.name === 'AbortError') return true
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'AbortError'
  ) {
    return true
  }
  return false
}

export function throwIfIncrementalSyncAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new IncrementalSyncAbortedError()
}

/** uploadAsync / downloadAsync 无原生 abort，用 signal 竞态取消 */
export async function raceWithIncrementalSyncAbort<T>(
  signal: AbortSignal | undefined,
  promise: Promise<T>
): Promise<T> {
  throwIfIncrementalSyncAborted(signal)
  if (!signal) return promise

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new IncrementalSyncAbortedError())
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    promise
      .then((value) => {
        signal.removeEventListener('abort', onAbort)
        if (signal.aborted) reject(new IncrementalSyncAbortedError())
        else resolve(value)
      })
      .catch((error) => {
        signal.removeEventListener('abort', onAbort)
        if (signal.aborted) reject(new IncrementalSyncAbortedError())
        else reject(error)
      })
  })
}
