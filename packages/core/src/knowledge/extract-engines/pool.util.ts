/** 有限并发池：最多 concurrency 个任务同时执行 */
export async function runPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, workerIndex: number) => Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1))
  let cursor = 0
  const runners = Array.from({ length: limit }, (_, workerIndex) =>
    (async () => {
      while (true) {
        if (signal?.aborted) throw new Error('knowledge-extract-cancelled')
        const i = cursor++
        if (i >= items.length) return
        await fn(items[i]!, workerIndex)
      }
    })()
  )
  await Promise.all(runners)
}

export function clampOcrConcurrency(value: number | undefined | null): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 1
  return Math.max(1, Math.min(3, n))
}

export function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof setImmediate === 'function') setImmediate(resolve)
    else setTimeout(resolve, 0)
  })
}
