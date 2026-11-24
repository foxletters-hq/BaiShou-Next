import type { ISqlExecutor } from '@baishou/shared'
import { sql } from 'drizzle-orm'
import { isRawSqlReadStatement } from './raw-sql.executor'
import { withExpoAgentDatabaseLock, type ExpoDbLockPriority } from './expo-agent-db.lock'
import { runWithSqliteBusyRetry } from './sqlite-busy.util'

type SqlRow = Record<string, unknown>
type SqlQueryInput = Parameters<ISqlExecutor['execute']>[0]
type SqlQueryResult = Awaited<ReturnType<ISqlExecutor['execute']>>

/** 从 SQL 抽取「动词:表名」作为锁诊断标签，避免慢锁日志显示 anonymous 且不泄露参数值 */
export function deriveSqlLockLabel(sqlStr: string): string {
  const normalized = sqlStr
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .trim()
  const verbMatch = /^([A-Za-z]+)/.exec(normalized)
  const verb = verbMatch ? verbMatch[1]!.toUpperCase() : 'SQL'
  const tableMatch =
    /\b(?:FROM|INTO|UPDATE|TABLE(?:\s+IF\s+NOT\s+EXISTS)?|INDEX(?:\s+IF\s+NOT\s+EXISTS)?)\s+[`"'\[]?([A-Za-z_][A-Za-z0-9_]*)[`"'\]]?/i.exec(
      normalized
    )
  return tableMatch ? `SqlExecutor.${verb}:${tableMatch[1]}` : `SqlExecutor.${verb}`
}

export interface PrioritizedSqlExecutor extends ISqlExecutor {
  executeWithPriority?(query: SqlQueryInput, priority: ExpoDbLockPriority): Promise<SqlQueryResult>
}

export interface CreateSqlExecutorOptions {
  /** 默认锁优先级（前台查库 `'high'`，后台批量索引可显式传 `'low'`） */
  priority?: ExpoDbLockPriority
}

/** 按指定锁优先级执行 SQL；对未实现扩展接口的普通 ISqlExecutor 自动降级为 execute() */
export function executeSqlWithPriority(
  executor: ISqlExecutor,
  query: SqlQueryInput,
  priority: ExpoDbLockPriority
): Promise<SqlQueryResult> {
  const prioritized = executor as PrioritizedSqlExecutor
  if (typeof prioritized.executeWithPriority === 'function') {
    return prioritized.executeWithPriority(query, priority)
  }
  return executor.execute(query)
}

/**
 * 将 Drizzle / better-sqlite3 / expo-sqlite / libsql 客户端统一为 ISqlExecutor。
 * 日记 RAG、Agent vector_search、HybridSearchRepository 均应通过此工厂接入数据库。
 */
export function createSqlExecutor(
  db: unknown,
  options?: CreateSqlExecutorOptions
): PrioritizedSqlExecutor {
  const defaultPriority: ExpoDbLockPriority = options?.priority ?? 'high'

  if (db && typeof (db as ISqlExecutor).execute === 'function') {
    const existing = db as PrioritizedSqlExecutor
    if (!options?.priority || existing.executeWithPriority === undefined) {
      return existing
    }
    return {
      execute: (statement) => existing.executeWithPriority!(statement, defaultPriority),
      executeWithPriority: (statement, priority) =>
        existing.executeWithPriority!(statement, priority)
    }
  }

  const root = db as Record<string, unknown>
  const client = (root?.session as { client?: unknown } | undefined)?.client ?? root?.$client ?? db

  const runStatement = async (
    statement: SqlQueryInput,
    priority: ExpoDbLockPriority
  ): Promise<SqlQueryResult> => {
    let sqlStr = ''
    let sqlArgs: unknown[] = []
    if (typeof statement === 'string') {
      sqlStr = statement
    } else {
      sqlStr = statement.sql
      sqlArgs = statement.args || []
    }

    const isQuery = isRawSqlReadStatement(sqlStr)
    const lockLabel = deriveSqlLockLabel(sqlStr)

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
        return withExpoAgentDatabaseLock(
          rawClient,
          () =>
            runWithSqliteBusyRetry(async () => {
              const rows = await (
                rawClient.getAllAsync as (sql: string, args: unknown[]) => Promise<SqlRow[]>
              )(sqlStr, sqlArgs)
              return { rows }
            }),
          priority,
          lockLabel
        )
      }
      return withExpoAgentDatabaseLock(
        rawClient,
        () =>
          runWithSqliteBusyRetry(async () => {
            const res = await (
              rawClient.runAsync as (sql: string, args: unknown[]) => Promise<{ changes: number }>
            )(sqlStr, sqlArgs)
            return { rows: [], rowsAffected: res.changes }
          }),
        priority,
        lockLabel
      )
    }

    const drizzleDb = db as {
      run?: (q: unknown, args?: unknown[]) => Promise<{ changes?: number }>
      all?: (q: unknown, args?: unknown[]) => Promise<SqlRow[]>
    }

    if (drizzleDb && typeof drizzleDb.run === 'function' && typeof drizzleDb.all === 'function') {
      if (isQuery) {
        return withExpoAgentDatabaseLock(
          drizzleDb,
          () =>
            runWithSqliteBusyRetry(async () => {
              const rows = await drizzleDb.all!(sql.raw(sqlStr), sqlArgs)
              return { rows }
            }),
          priority,
          lockLabel
        )
      }
      return withExpoAgentDatabaseLock(
        drizzleDb,
        () =>
          runWithSqliteBusyRetry(async () => {
            const res = await drizzleDb.run!(sql.raw(sqlStr), sqlArgs)
            return { rows: [], rowsAffected: res.changes }
          }),
        priority,
        lockLabel
      )
    }

    if (drizzleDb && typeof drizzleDb.run === 'function') {
      return withExpoAgentDatabaseLock(
        drizzleDb,
        () =>
          runWithSqliteBusyRetry(async () => {
            const res = await drizzleDb.run!(sql.raw(sqlStr), sqlArgs)
            const rows = Array.isArray(res) ? (res as SqlRow[]) : []
            return { rows, rowsAffected: res?.changes }
          }),
        priority,
        lockLabel
      )
    }

    throw new Error('Unsupported database client type for ISqlExecutor wrapping')
  }

  return {
    execute: (statement) => runStatement(statement, defaultPriority),
    executeWithPriority: (statement, priority) => runStatement(statement, priority)
  }
}

/** 从 Drizzle AppDatabase 实例创建 ISqlExecutor（Agent 主库等场景）。 */
export function createSqlExecutorFromDrizzleDb(
  drizzleDb: unknown,
  options?: CreateSqlExecutorOptions
): PrioritizedSqlExecutor {
  const root = drizzleDb as { session?: { client?: unknown } }
  const rawClient = root?.session?.client ?? drizzleDb
  return createSqlExecutor(rawClient, options)
}
