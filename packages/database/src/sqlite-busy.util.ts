function collectErrorText(error: unknown): string {
  const parts: string[] = []
  if (error instanceof Error) {
    parts.push(error.message)
    const code = (error as Error & { code?: string }).code
    if (code) parts.push(code)
    if (typeof error.cause === 'string') parts.push(error.cause)
    else if (error.cause instanceof Error) parts.push(error.cause.message)
    else if (error.cause != null) parts.push(String(error.cause))
    const anyErr = error as Error & { userInfo?: unknown; nativeStackAndroid?: unknown }
    if (anyErr.userInfo != null) parts.push(String(anyErr.userInfo))
  } else if (typeof error === 'string') {
    parts.push(error)
  }
  // RN / Expo 原生错误有时只有 String(error) 带全量文案
  try {
    parts.push(String(error))
  } catch {
    // ignore
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

/**
 * expo-sqlite 原生句柄已失效（关闭/隔离/热重载/并发 prepareSync 炸掉）。
 * 继续对同一批文件重试只会刷屏，应中止本轮并等待 watcher 用新 deps 重启。
 * 注意：勿把 SQLITE_BUSY 的 “has been rejected” 误判进来。
 */
export function isExpoSqliteNativeUnavailableError(error: unknown): boolean {
  if (isSqliteDatabaseLockedError(error)) return false
  const text = collectErrorText(error).toLowerCase()
  if (!text) return false
  return (
    text.includes('nullpointerexception') ||
    text.includes('database is closed') ||
    text.includes('connection is closed') ||
    text.includes('object is null') ||
    (text.includes('nativedatabase') &&
      (text.includes('preparesync') || text.includes('execasync') || text.includes('prepareasync')))
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
      if (isExpoSqliteNativeUnavailableError(error)) {
        throw error
      }
      if (!isSqliteDatabaseLockedError(error) || attempt === attempts - 1) {
        throw error
      }
      const delayMs = baseDelayMs * (attempt + 1) ** 2
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}
