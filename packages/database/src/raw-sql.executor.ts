export interface RawSqlResult {
  rows: any[]
  rowsAffected?: number
  lastInsertRowid?: number | bigint
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

  if (typeof client.execute === 'function') {
    if (args.length > 0) {
      return await client.execute({ sql: statement, args })
    }
    return await client.execute(statement)
  }

  if (args.length > 0) {
    const stmt = client.prepare(statement)
    const info = stmt.run(...args)
    return {
      rows: [],
      rowsAffected: info.changes,
      lastInsertRowid: info.lastInsertRowid
    }
  }

  const trimmed = statement.trim().toUpperCase()
  const isReadQuery = trimmed.startsWith('SELECT') || trimmed.includes('TABLE_INFO')

  if (isReadQuery) {
    const rows = client.prepare(statement).all()
    return { rows }
  }

  client.exec(statement)
  return { rows: [] }
}
