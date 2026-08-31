export const OCR_CONCURRENCY_MIN = 1
export const OCR_CONCURRENCY_MAX = 10
export const DEFAULT_OCR_CONCURRENCY = 1

/** 将用户配置的 OCR / 视觉识图并发限制在 1–10。 */
export function clampOcrConcurrency(value: number | undefined | null): number {
  const n =
    typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : DEFAULT_OCR_CONCURRENCY
  return Math.max(OCR_CONCURRENCY_MIN, Math.min(OCR_CONCURRENCY_MAX, n))
}

export function listOcrConcurrencyValues(): number[] {
  return Array.from(
    { length: OCR_CONCURRENCY_MAX - OCR_CONCURRENCY_MIN + 1 },
    (_, i) => OCR_CONCURRENCY_MIN + i
  )
}

export const BATCH_EMBED_CONCURRENCY_MIN = 1
export const BATCH_EMBED_CONCURRENCY_MAX = 20
export const DEFAULT_BATCH_EMBED_CONCURRENCY = 20

/** 移动端批量嵌入默认并发（未配置时） */
export const MOBILE_DEFAULT_BATCH_EMBED_CONCURRENCY = 5
/** 移动端批量嵌入并发上限（含从桌面同步下来的较高值） */
export const MOBILE_BATCH_EMBED_CONCURRENCY_CAP = 10

/** Clamp user-configured batch-embed diary concurrency. */
export function resolveBatchEmbedConcurrency(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return DEFAULT_BATCH_EMBED_CONCURRENCY
  return Math.min(BATCH_EMBED_CONCURRENCY_MAX, Math.max(BATCH_EMBED_CONCURRENCY_MIN, Math.round(n)))
}

/** 移动端批量嵌入并发：未配置默认 5，已配置值限制在 1–10。 */
export function resolveMobileBatchEmbedConcurrency(value: unknown): number {
  if (value === undefined || value === null) {
    return MOBILE_DEFAULT_BATCH_EMBED_CONCURRENCY
  }
  const resolved = resolveBatchEmbedConcurrency(value)
  return Math.min(
    MOBILE_BATCH_EMBED_CONCURRENCY_CAP,
    Math.max(BATCH_EMBED_CONCURRENCY_MIN, resolved)
  )
}

/** 语义搜索 / 嵌入查询默认超时（毫秒） */
export const SEMANTIC_SEARCH_TIMEOUT_MS = 15_000

export async function withPromiseTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'operation'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      })
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** Run async work over items with a fixed concurrency limit. */
export async function limitExecute<T, R>(
  items: T[],
  concurrencyLimit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []

  const results: R[] = new Array(items.length)
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++
      const item = items[currentIndex]!
      results[currentIndex] = await fn(item, currentIndex)
    }
  }

  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrencyLimit), items.length) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}
