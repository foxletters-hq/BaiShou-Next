import { describe, it, expect } from 'vitest'
import { createClient } from '@libsql/client'
import { executeRawSql } from '../raw-sql.executor'

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
})
