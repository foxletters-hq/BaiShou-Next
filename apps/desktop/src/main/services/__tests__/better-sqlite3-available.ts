import Database from 'better-sqlite3'

/** 本机 Node 与 better-sqlite3 二进制不一致时跳过需真实 SQLite 的集成测 */
export function isBetterSqlite3Available(): boolean {
  try {
    const db = new Database(':memory:')
    db.close()
    return true
  } catch {
    return false
  }
}
