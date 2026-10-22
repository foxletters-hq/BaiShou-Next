/** 全局嵌入槽位上限：限制所有嵌入路径并发在途 HTTP 请求数，兼顾高吞吐与防止连接池饥饿。 */
export const EMBED_MAX_IN_FLIGHT = 12
/** 单次嵌入槽位最长占用时间（毫秒），防止上游 HTTP 连接挂起导致槽位永久泄漏死锁。 */
const EMBED_SLOT_TIMEOUT_MS = 60_000

let inFlight = 0
const waitQueue: Array<() => void> = []
let lastMainThreadYieldAt = Date.now()

/**
 * 在同步分词/大循环中按时间片（默认 12ms）让出事件循环，保持桌面端/移动端 UI 帧率响应。
 * 在 Vitest Fake Timers 环境下自动退化为微任务，避免单测未推进定时器时挂起。
 */
export async function yieldMainThreadIfNeeded(minSliceMs = 12): Promise<void> {
  const now = Date.now()
  if (now - lastMainThreadYieldAt < minSliceMs) return
  lastMainThreadYieldAt = now
  const isFakeTimer =
    typeof (setTimeout as unknown as { clock?: unknown }).clock !== 'undefined' ||
    '_isMockFunction' in setTimeout
  if (isFakeTimer) {
    await Promise.resolve()
    return
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

function releaseSlot(): void {
  inFlight = Math.max(0, inFlight - 1)
  const next = waitQueue.shift()
  if (next) next()
}

async function acquireSlot(): Promise<void> {
  if (inFlight < EMBED_MAX_IN_FLIGHT) {
    inFlight++
    return
  }
  await new Promise<void>((resolve) => {
    waitQueue.push(() => {
      inFlight++
      resolve()
    })
  })
}

export async function withEmbeddingSlot<T>(action: () => Promise<T>): Promise<T> {
  await acquireSlot()
  let released = false
  const releaseOnce = (): void => {
    if (released) return
    released = true
    releaseSlot()
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      action(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          releaseOnce()
          reject(new Error(`Embedding request timed out after ${EMBED_SLOT_TIMEOUT_MS}ms`))
        }, EMBED_SLOT_TIMEOUT_MS)
        if (typeof (timer as { unref?: () => void }).unref === 'function') {
          ;(timer as { unref: () => void }).unref()
        }
      })
    ])
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
    releaseOnce()
  }
}
