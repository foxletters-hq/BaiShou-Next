import { logger } from './logger'

export const SHORTCUT_TRACE_CHAIN = 'Shortcut链'

function summarizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      preview: value.slice(0, 3).map((item) => {
        if (item && typeof item === 'object' && 'id' in item) {
          const row = item as { id?: string; name?: string }
          return { id: row.id, name: row.name }
        }
        return item
      })
    }
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as object)
    return { type: 'object', keys: keys.slice(0, 12), keyCount: keys.length }
  }
  if (typeof value === 'string' && value.length > 120) {
    return `${value.slice(0, 120)}…`
  }
  return value
}

export async function traceCall<T>(
  chain: string,
  step: string,
  fn: () => Promise<T> | T,
  meta?: Record<string, unknown>
): Promise<T> {
  const label = `[${chain}] ${step}`
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now()
  logger.info(`${label} ➔`, meta ? { ...meta, payload: summarizeValue(meta.payload) } : {})
  try {
    const result = await fn()
    const cost = Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start
    )
    logger.info(`${label} ⬅ ok (${cost}ms)`, { result: summarizeValue(result) })
    return result
  } catch (error) {
    const cost = Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start
    )
    logger.error(`${label} ❌ fail (${cost}ms)`, error as Error)
    throw error
  }
}
