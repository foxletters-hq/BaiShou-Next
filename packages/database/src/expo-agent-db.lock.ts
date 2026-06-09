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

let expoAgentDbMutex: Promise<void> = Promise.resolve()

/** 串行化 Agent 主库上的所有 Drizzle / runAsync 访问（仅 expo-sync） */
export function withExpoAgentDatabaseLock<T>(db: unknown, fn: () => Promise<T>): Promise<T> {
  if (detectSqliteDriver(db) !== 'expo-sync') {
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
