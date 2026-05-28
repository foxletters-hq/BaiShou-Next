/**
 * Normalize Vercel AI SDK / provider HTTP errors into user-facing text.
 * Used by desktop IPC (main) and settings UI (renderer).
 */

export type AiApiErrorKind = 'balance' | 'auth' | 'rate_limit' | 'network' | 'unknown'

function readResponseBody(error: Record<string, unknown>): string | undefined {
  const body =
    error.responseBody ?? (error.cause as Record<string, unknown> | undefined)?.responseBody
  if (typeof body !== 'string' || !body.trim()) return undefined
  try {
    const parsed = JSON.parse(body) as { message?: unknown }
    if (typeof parsed?.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim()
    }
  } catch {
    // ignore invalid JSON
  }
  return undefined
}

/** Extract the most specific message from an AI HTTP / SDK error. */
export function formatAiApiCallError(error: unknown): string {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error

  const e = error as Record<string, unknown>
  const fromBody = readResponseBody(e)
  if (fromBody) return fromBody

  const data = e.data as { message?: unknown } | undefined
  if (typeof data?.message === 'string' && data.message.trim()) {
    return data.message.trim()
  }

  const message = typeof e.message === 'string' ? e.message : String(error)
  if (message && message !== '[object Object]') return message

  return 'Unknown error'
}

export function classifyAiApiCallError(error: unknown): AiApiErrorKind {
  const e = error as Record<string, unknown>
  const text = `${formatAiApiCallError(error)} ${readResponseBody(e) ?? ''}`.toLowerCase()
  const status = typeof e.statusCode === 'number' ? e.statusCode : 0

  if (
    text.includes('insufficient') ||
    text.includes('balance') ||
    text.includes('quota') ||
    text.includes('payment required') ||
    status === 402
  ) {
    return 'balance'
  }
  if (
    status === 401 ||
    status === 403 ||
    text.includes('api key') ||
    text.includes('invalid_api_key') ||
    text.includes('unauthorized') ||
    text.includes('forbidden')
  ) {
    return 'auth'
  }
  if (status === 429 || text.includes('rate limit') || text.includes('too many requests')) {
    return 'rate_limit'
  }
  if (
    text.includes('network') ||
    text.includes('fetch failed') ||
    text.includes('econnrefused') ||
    text.includes('econnreset') ||
    text.includes('timeout')
  ) {
    return 'network'
  }
  return 'unknown'
}

/** Build a plain Error safe to send over Electron IPC. */
export function toSerializableAiError(error: unknown, prefix?: string): Error {
  const detail = formatAiApiCallError(error)
  const message = prefix ? `${prefix}: ${detail}` : detail
  return new Error(message)
}
