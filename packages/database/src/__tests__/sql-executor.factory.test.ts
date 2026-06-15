import { describe, it, expect, vi } from 'vitest'
import { createSqlExecutor, createSqlExecutorFromDrizzleDb } from '../sql-executor.factory'

describe('createSqlExecutor', () => {
  it('returns existing ISqlExecutor as-is', async () => {
    const executor = {
      execute: vi.fn().mockResolvedValue({ rows: [{ id: 1 }] })
    }
    const wrapped = createSqlExecutor(executor)
    expect(wrapped).toBe(executor)
    await wrapped.execute('SELECT 1')
    expect(executor.execute).toHaveBeenCalledWith('SELECT 1')
  })

  it('routes SELECT through expo-sqlite getAllAsync', async () => {
    const getAllAsync = vi.fn().mockResolvedValue([{ embedding_id: 'a' }])
    const runAsync = vi.fn()
    const wrapped = createSqlExecutor({ getAllAsync, runAsync })

    const res = await wrapped.execute({
      sql: 'SELECT * FROM memory_embeddings WHERE id = ?',
      args: ['a']
    })

    expect(getAllAsync).toHaveBeenCalledWith('SELECT * FROM memory_embeddings WHERE id = ?', ['a'])
    expect(runAsync).not.toHaveBeenCalled()
    expect(res.rows).toEqual([{ embedding_id: 'a' }])
  })

  it('routes writes through expo-sqlite runAsync', async () => {
    const getAllAsync = vi.fn()
    const runAsync = vi.fn().mockResolvedValue({ changes: 2 })
    const wrapped = createSqlExecutor({ getAllAsync, runAsync })

    const res = await wrapped.execute({
      sql: 'DELETE FROM memory_embeddings',
      args: []
    })

    expect(runAsync).toHaveBeenCalledWith('DELETE FROM memory_embeddings', [])
    expect(getAllAsync).not.toHaveBeenCalled()
    expect(res.rowsAffected).toBe(2)
  })

  it('routes SELECT through better-sqlite3 prepare/all', async () => {
    const stmt = {
      all: vi.fn().mockReturnValue([{ count: 3 }]),
      run: vi.fn()
    }
    const prepare = vi.fn().mockReturnValue(stmt)
    const wrapped = createSqlExecutor({ prepare })

    const res = await wrapped.execute('SELECT count(*) as count FROM memory_embeddings')

    expect(prepare).toHaveBeenCalledWith('SELECT count(*) as count FROM memory_embeddings')
    expect(stmt.all).toHaveBeenCalledWith()
    expect(res.rows).toEqual([{ count: 3 }])
  })

  it('createSqlExecutorFromDrizzleDb unwraps drizzle session client', async () => {
    const getAllAsync = vi.fn().mockResolvedValue([])
    const runAsync = vi.fn()
    const drizzleDb = {
      session: { client: { getAllAsync, runAsync } }
    }
    const wrapped = createSqlExecutorFromDrizzleDb(drizzleDb)
    await wrapped.execute('SELECT 1')
    expect(getAllAsync).toHaveBeenCalledWith('SELECT 1', [])
  })
})
