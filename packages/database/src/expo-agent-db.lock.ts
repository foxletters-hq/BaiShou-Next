/**
 * expo-sqlite（prepareSync）与 runAsync / Drizzle 查询不能并发争用同一连接，
 * 否则 Android 上会触发 NativeDatabase.prepareSync NullPointerException。
 */

export type SqliteDriverKind = 'better-sqlite' | 'expo-sync' | 'async'

export function detectSqliteDriver(db: unknown): SqliteDriverKind {
  const client = (db as { session?: { client?: Record<string, unknown> } })?.session?.client
  if (client?.prepare !== undefined) return 'better-sqlite'
  if (client?.prepareSync !== undefined) return 'expo-sync'
  return 'async'
}

export function usesSyncTransaction(db: unknown): boolean {
  const kind = detectSqliteDriver(db)
  return kind === 'better-sqlite' || kind === 'expo-sync'
}

/** Agent 主库（expo / drizzle）是否需要 JS 侧串行化 */
export function shouldSerializeExpoAgentDatabase(db: unknown): boolean {
  return detectSqliteDriver(db) !== 'better-sqlite'
}

let expoAgentDbMutex: Promise<void> = Promise.resolve()

/** 等待 Agent 主库上已排队的 Drizzle / runAsync 访问全部结束 */
export function waitForExpoAgentDatabaseIdle(): Promise<void> {
  return expoAgentDbMutex
}

/** 串行化 Agent 主库上的 Drizzle / runAsync 访问（expo 与 drizzle async 驱动） */
export function withExpoAgentDatabaseLock<T>(db: unknown, fn: () => Promise<T>): Promise<T> {
  if (!shouldSerializeExpoAgentDatabase(db)) {
    return fn()
  }

  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const previous = expoAgentDbMutex
  expoAgentDbMutex = previous.then(() => gate)

  return previous
    .then(() => fn())
    .finally(() => {
      release()
    })
}

/** 无 drizzle 句柄时，对同一 Agent 主库 raw expo-sqlite 访问串行化 */
export function withExpoAgentRawSqliteLock<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const previous = expoAgentDbMutex
  expoAgentDbMutex = previous.then(() => gate)

  return previous
    .then(() => fn())
    .finally(() => {
      release()
    })
}
