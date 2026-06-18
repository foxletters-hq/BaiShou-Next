import { describe, it, expect } from 'vitest'
import { createClient } from '@libsql/client'
import { executeRawSql, isRawSqlReadStatement } from '../raw-sql.executor'

describe('isRawSqlReadStatement', () => {
  it('treats PRAGMA assignment as write', () => {
    expect(isRawSqlReadStatement('PRAGMA foreign_keys=OFF')).toBe(false)
    expect(isRawSqlReadStatement('PRAGMA journal_mode=WAL')).toBe(false)
    expect(isRawSqlReadStatement("PRAGMA table_info('t')")).toBe(true)
    expect(isRawSqlReadStatement('PRAGMA integrity_check')).toBe(true)
  })

  it('treats WITH ... UPDATE as write', () => {
    expect(
      isRawSqlReadStatement(
        'WITH ordered AS (SELECT id FROM t) UPDATE t SET v = 1 WHERE id IN (SELECT id FROM ordered)'
      )
    ).toBe(false)
  })
})

describe('executeRawSql (libsql client)', () => {
  it('runs PRAGMA table_info and parameterized UPDATE', async () => {
    const client = createClient({ url: ':memory:' })
    await executeRawSql(client, 'CREATE TABLE t (id TEXT PRIMARY KEY, v TEXT)')
    await executeRawSql(client, 'INSERT INTO t (id, v) VALUES (?, ?)', ['a', 'old'])
    const info = await executeRawSql(client, "PRAGMA table_info('t')")
    expect(info.rows.map((r: { name: string }) => r.name)).toEqual(['id', 'v'])
    await executeRawSql(client, 'UPDATE t SET v = ? WHERE id = ?', ['new', 'a'])
    const rows = await executeRawSql(client, 'SELECT v FROM t WHERE id = ?', ['a'])
    expect(rows.rows[0]?.v).toBe('new')
    client.close()
  })

  it('unwraps a Drizzle db session client before using execute()', async () => {
    const calls: unknown[] = []
    const drizzleLikeDb = {
      execute: () => {
        throw new Error('drizzle execute should not be used for raw SQL')
      },
      session: {
        client: {
          execute: async (statement: unknown) => {
            calls.push(statement)
            return { rows: [{ ok: 1 }] }
          }
        }
      }
    }

    const result = await executeRawSql(drizzleLikeDb, 'SELECT 1 AS ok')

    expect(result.rows).toEqual([{ ok: 1 }])
    expect(calls).toEqual(['SELECT 1 AS ok'])
  })
})

describe('executeRawSql (better-sqlite3)', () => {
  it('runs PRAGMA foreign_keys assignment via run()', async () => {
    const Database = (await import('better-sqlite3')).default
    const db = new Database(':memory:')
    await executeRawSql(db, 'PRAGMA foreign_keys=OFF')
    await executeRawSql(db, 'PRAGMA foreign_keys=ON')
    db.close()
  })
})
