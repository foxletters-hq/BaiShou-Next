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

  const trimmedStatement = statement.trim().toUpperCase()
  const isReadQuery =
    trimmedStatement.startsWith('SELECT') ||
    trimmedStatement.startsWith('PRAGMA') ||
    trimmedStatement.includes('TABLE_INFO')

  // Expo SQLite (React Native)
  if (typeof client.getAllAsync === 'function' && typeof client.runAsync === 'function') {
    if (args.length > 0) {
      if (isReadQuery) {
        const rows = await client.getAllAsync(statement, args)
        return { rows }
      }
      const res = await client.runAsync(statement, args)
      return {
        rows: [],
        rowsAffected: res.changes,
        lastInsertRowid: res.lastInsertRowId
      }
    }
    if (isReadQuery) {
      const rows = await client.getAllAsync(statement)
      return { rows }
    }
    await client.runAsync(statement)
    return { rows: [] }
  }

  if (typeof client.execute === 'function') {
    if (args.length > 0) {
      return await client.execute({ sql: statement, args })
    }
    return await client.execute(statement)
  }

  if (args.length > 0) {
    const stmt = client.prepare(statement)
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
    const rows = client.prepare(statement).all()
    return { rows }
  }

  client.exec(statement)
  return { rows: [] }
}
