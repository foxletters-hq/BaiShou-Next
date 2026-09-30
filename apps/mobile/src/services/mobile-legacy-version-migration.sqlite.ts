import * as SQLite from 'expo-sqlite'

/**
 * 版本迁移的 ATTACH 不能打在正在使用的 Agent 主库上。
 * 主库加载了 sqlite-vec，ATTACH 会让原生层直接退出。
 */
export async function withMobileMigrationSqlite<T>(
  fn: (client: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const name = `baishou_migration_${Date.now()}.db`
  const db = await SQLite.openDatabaseAsync(name, { useNewConnection: true })
  try {
    return await fn(db)
  } finally {
    try {
      await db.closeAsync()
    } catch {
      /* ignore */
    }
    try {
      await SQLite.deleteDatabaseAsync(name)
    } catch {
      /* ignore */
    }
  }
}
