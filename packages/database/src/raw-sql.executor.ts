export interface RawSqlResult {
  rows: any[]
  rowsAffected?: number
  lastInsertRowid?: number | bigint
}

/**
 * 判断原始 SQL 是否应走「读」路径（all/get/getAllAsync）。
 * better-sqlite3 对 PRAGMA foreign_keys=OFF 等赋值语句调用 .all() 会抛
 * "This statement does not return data. Use run() instead"。
 */
export function isRawSqlReadStatement(statement: string): boolean {
  const trimmed = statement.trim().toUpperCase()
  if (trimmed.startsWith('SELECT')) return true
  if (trimmed.includes('TABLE_INFO')) return true
  if (trimmed.startsWith('WITH')) {
    return /\bSELECT\b/.test(trimmed) && !/\b(UPDATE|INSERT|DELETE)\b/.test(trimmed)
  }
  if (trimmed.startsWith('PRAGMA')) {
    // PRAGMA table_info / integrity_check 等读操作；PRAGMA x = y 为写操作
    return !/=\s*\S/.test(trimmed)
  }
  return false
}

/**
 * 在 LibSQL Client 与 Better-SQLite3 Database 上执行原始 SQL。
 * Desktop 使用 better-sqlite3；移动端/部分测试使用 libsql。
 */
export async function executeRawSql(
  client: any,
  statement: string,
  args: any[] = []
): Promise<RawSqlResult> {
  if (!client) {
    throw new Error('[executeRawSql] No database client available.')
  }

  const rawClient = client?.session?.client ?? client
  const isReadQuery = isRawSqlReadStatement(statement)

  // Expo SQLite (React Native)
  if (typeof rawClient.getAllAsync === 'function' && typeof rawClient.runAsync === 'function') {
    if (args.length > 0) {
      if (isReadQuery) {
        const rows = await rawClient.getAllAsync(statement, args)
        return { rows }
      }
      const res = await rawClient.runAsync(statement, args)
      return {
        rows: [],
        rowsAffected: res.changes,
        lastInsertRowid: res.lastInsertRowId
      }
    }
    if (isReadQuery) {
      const rows = await rawClient.getAllAsync(statement)
      return { rows }
    }
    await rawClient.runAsync(statement)
    return { rows: [] }
  }

  if (typeof rawClient.execute === 'function') {
    if (args.length > 0) {
      return await rawClient.execute({ sql: statement, args })
    }
    return await rawClient.execute(statement)
  }

  if (args.length > 0) {
    const stmt = rawClient.prepare(statement)
    if (isReadQuery) {
      const rows = stmt.all(...args)
      return { rows }
    } else {
      const info = stmt.run(...args)
      return {
        rows: [],
        rowsAffected: info.changes,
        lastInsertRowid: info.lastInsertRowid
      }
    }
  }

  if (isReadQuery) {
    const rows = rawClient.prepare(statement).all()
    return { rows }
  }

  rawClient.exec(statement)
  return { rows: [] }
}
