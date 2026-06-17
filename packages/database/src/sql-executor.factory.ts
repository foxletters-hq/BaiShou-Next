import type { ISqlExecutor } from '@baishou/shared'
import { sql } from 'drizzle-orm'
import { isRawSqlReadStatement } from './raw-sql.executor'

type SqlRow = Record<string, unknown>

/**
 * 将 Drizzle / better-sqlite3 / expo-sqlite / libsql 客户端统一为 ISqlExecutor。
 * 日记 RAG、Agent vector_search、HybridSearchRepository 均应通过此工厂接入数据库。
 */
export function createSqlExecutor(db: unknown): ISqlExecutor {
  if (db && typeof (db as ISqlExecutor).execute === 'function') {
    return db as ISqlExecutor
  }

  const root = db as Record<string, unknown>
  const client = (root?.session as { client?: unknown } | undefined)?.client ?? root?.$client ?? db

  return {
    execute: async (statement) => {
      let sqlStr = ''
      let sqlArgs: unknown[] = []
      if (typeof statement === 'string') {
        sqlStr = statement
      } else {
        sqlStr = statement.sql
        sqlArgs = statement.args || []
      }

      const isQuery = isRawSqlReadStatement(sqlStr)

      const rawClient = client as Record<string, unknown>

      // better-sqlite3
      if (rawClient && typeof rawClient.prepare === 'function') {
        const stmt = (
          rawClient.prepare as (sql: string) => {
            all: (...args: unknown[]) => SqlRow[]
            run: (...args: unknown[]) => { changes: number }
          }
        )(sqlStr)
        if (isQuery) {
          return { rows: stmt.all(...sqlArgs) }
        }
        const res = stmt.run(...sqlArgs)
        return { rows: [], rowsAffected: res.changes }
      }

      // expo-sqlite
      if (
        rawClient &&
        typeof rawClient.getAllAsync === 'function' &&
        typeof rawClient.runAsync === 'function'
      ) {
        if (isQuery) {
          const rows = await (
            rawClient.getAllAsync as (sql: string, args: unknown[]) => Promise<SqlRow[]>
          )(sqlStr, sqlArgs)
          return { rows }
        }
        const res = await (
          rawClient.runAsync as (sql: string, args: unknown[]) => Promise<{ changes: number }>
        )(sqlStr, sqlArgs)
        return { rows: [], rowsAffected: res.changes }
      }

      const drizzleDb = db as {
        run?: (q: unknown, args?: unknown[]) => Promise<{ changes?: number }>
        all?: (q: unknown, args?: unknown[]) => Promise<SqlRow[]>
      }

      if (drizzleDb && typeof drizzleDb.run === 'function' && typeof drizzleDb.all === 'function') {
        if (isQuery) {
          const rows = await drizzleDb.all(sql.raw(sqlStr), sqlArgs)
          return { rows }
        }
        const res = await drizzleDb.run(sql.raw(sqlStr), sqlArgs)
        return { rows: [], rowsAffected: res.changes }
      }

      if (drizzleDb && typeof drizzleDb.run === 'function') {
        const res = await drizzleDb.run(sql.raw(sqlStr), sqlArgs)
        const rows = Array.isArray(res) ? (res as SqlRow[]) : []
        return { rows, rowsAffected: res?.changes }
      }

      throw new Error('Unsupported database client type for ISqlExecutor wrapping')
    }
  }
}

/** 从 Drizzle AppDatabase 实例创建 ISqlExecutor（Agent 主库等场景）。 */
export function createSqlExecutorFromDrizzleDb(drizzleDb: unknown): ISqlExecutor {
  const root = drizzleDb as { session?: { client?: unknown } }
  const rawClient = root?.session?.client ?? drizzleDb
  return createSqlExecutor(rawClient)
}
