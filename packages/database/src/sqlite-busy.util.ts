function collectErrorText(error: unknown): string {
  const parts: string[] = []
  if (error instanceof Error) {
    parts.push(error.message)
    const code = (error as Error & { code?: string }).code
    if (code) parts.push(code)
    if (typeof error.cause === 'string') parts.push(error.cause)
    else if (error.cause instanceof Error) parts.push(error.cause.message)
  } else if (typeof error === 'string') {
    parts.push(error)
  } else {
    parts.push(String(error))
  }
  return parts.join('\n')
}

/** SQLite 短暂争用（非损坏），可重试 */
export function isSqliteDatabaseLockedError(error: unknown): boolean {
  const text = collectErrorText(error).toLowerCase()
  if (!text) return false
  return (
    text.includes('database is locked') ||
    text.includes('sqlite_busy') ||
    text.includes('error code : database is locked')
  )
}

const DEFAULT_BUSY_RETRY_ATTEMPTS = 8
const DEFAULT_BUSY_RETRY_BASE_MS = 50

/** 对 SQLITE_BUSY / database is locked 做指数退避重试 */
export async function runWithSqliteBusyRetry<T>(
  operation: () => Promise<T>,
  options?: { attempts?: number; baseDelayMs?: number }
): Promise<T> {
  const attempts = options?.attempts ?? DEFAULT_BUSY_RETRY_ATTEMPTS
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BUSY_RETRY_BASE_MS
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isSqliteDatabaseLockedError(error) || attempt === attempts - 1) {
        throw error
      }
      const delayMs = baseDelayMs * (attempt + 1) ** 2
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}
