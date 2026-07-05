export function isTransientNetworkError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error)
  return /network request failed|fetch failed|failed to fetch|timed out|timeout|econnreset|enetunreach|network error|err_network/i.test(
    message
  )
}

export async function withTransientNetworkRetry<T>(
  run: () => Promise<T>,
  options?: {
    retries?: number
    baseDelayMs?: number
    shouldRetry?: (error: unknown) => boolean
  }
): Promise<T> {
  const retries = options?.retries ?? 4
  const baseDelayMs = options?.baseDelayMs ?? 500
  const shouldRetry = options?.shouldRetry ?? isTransientNetworkError

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      if (attempt >= retries || !shouldRetry(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt))
    }
  }
  throw lastError
}
