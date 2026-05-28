export function extractApiErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return String(error ?? 'Unknown error')
  }

  const err = error as {
    message?: string
    responseBody?: string | { message?: string; code?: number }
  }

  const body = err.responseBody
  if (body) {
    try {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body
      if (parsed?.message && typeof parsed.message === 'string') {
        return parsed.message
      }
    } catch {
      if (typeof body === 'string' && body.trim()) {
        return body
      }
    }
  }

  return err.message || 'Unknown error'
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
