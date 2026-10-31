function extractMessageFromParsedBody(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== 'object') return null
  const record = parsed as {
    message?: unknown
    detail?: unknown
    error?: unknown
  }
  if (record.error && typeof record.error === 'object') {
    const nestedMsg = (record.error as { message?: unknown }).message
    if (typeof nestedMsg === 'string' && nestedMsg.trim()) {
      return nestedMsg.trim()
    }
  }
  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error.trim()
  }
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim()
  }
  if (typeof record.detail === 'string' && record.detail.trim()) {
    return record.detail.trim()
  }
  return null
}

function formatHttpStatusFallback(statusCode: number): string {
  switch (statusCode) {
    case 401:
      return 'HTTP 401 Unauthorized (invalid_api_key)'
    case 402:
      return 'HTTP 402 Payment Required (Insufficient Balance)'
    case 403:
      return 'HTTP 403 Forbidden'
    case 404:
      return 'HTTP 404 Not Found'
    case 429:
      return 'HTTP 429 Too Many Requests (rate limit)'
    default:
      return `HTTP ${statusCode}`
  }
}

export function extractApiErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return String(error ?? 'Unknown error')
  }

  const err = error as {
    message?: string
    statusCode?: number
    data?: unknown
    responseBody?: string | { message?: string; code?: number; error?: unknown }
  }

  const body = err.responseBody
  if (body) {
    try {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body
      const extracted = extractMessageFromParsedBody(parsed)
      if (extracted) {
        return extracted
      }
    } catch {
      if (typeof body === 'string' && body.trim()) {
        return body.trim()
      }
    }
  }

  const fromData = extractMessageFromParsedBody(err.data)
  if (fromData) {
    return fromData
  }

  if (typeof err.message === 'string' && err.message.trim()) {
    return err.message.trim()
  }

  if (typeof err.statusCode === 'number' && Number.isFinite(err.statusCode)) {
    return formatHttpStatusFallback(err.statusCode)
  }

  return 'Unknown error'
}

export function normalizeApiErrorObject(error: unknown): Error {
  if (error instanceof Error) {
    if (!error.message.trim()) {
      const resolved = extractApiErrorMessage(error)
      try {
        error.message = resolved
      } catch {
        const wrapped = new Error(resolved)
        wrapped.name = error.name
        return wrapped
      }
    }
    return error
  }
  return new Error(extractApiErrorMessage(error))
}

/**
 * 连接测试时，推理模型常因 max_tokens=1 触顶；能收到该错误说明鉴权与网络已通。
 */
export function isBenignConnectionTestLimitError(detail: string): boolean {
  return /max_tokens|model output limit was reached|finish.?reason.*length/i.test(detail)
}

export function formatModelNotAvailableMessage(
  providerName: string,
  modelId: string,
  suggestions: string[]
): string {
  const hint =
    suggestions.length > 0
      ? ` Available chat models: ${suggestions.slice(0, 5).join(', ')}`
      : ' Please fetch the model list and pick a dialogue (chat) model.'
  return `Model "${modelId}" is not available on ${providerName}.${hint}`
}
