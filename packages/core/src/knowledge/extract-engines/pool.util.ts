export { clampOcrConcurrency } from '@baishou/shared'

/** 按并发窗口切批，供 PDF 整批渲染后再并行识图。 */
export function chunkItems<T>(items: T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size) || 1)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += n) {
    out.push(items.slice(i, i + n))
  }
  return out
}

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

export function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof setImmediate === 'function') setImmediate(resolve)
    else setTimeout(resolve, 0)
  })
}
