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

  it('retries when expo-sqlite throws database is locked error on query', async () => {
    let callCount = 0
    const getAllAsync = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        throw new Error(
          "Call to function 'NativeStatement.finalizeAsync' has been rejected.\n→ Caused by: Error code : database is locked"
        )
      }
      return [{ id: 100 }]
    })
    const runAsync = vi.fn()
    const wrapped = createSqlExecutor({ getAllAsync, runAsync })

    const res = await wrapped.execute('SELECT * FROM memory_embeddings')
    expect(callCount).toBe(2)
    expect(res.rows).toEqual([{ id: 100 }])
  })

  it('retries when expo-sqlite throws database is locked error on write', async () => {
    let callCount = 0
    const getAllAsync = vi.fn()
    const runAsync = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        throw new Error('sqlite3_step failed: Error code : database is locked')
      }
      return { changes: 1 }
    })
    const wrapped = createSqlExecutor({ getAllAsync, runAsync })

    const res = await wrapped.execute('DELETE FROM memory_embeddings WHERE id = 1')
    expect(callCount).toBe(2)
    expect(res.rowsAffected).toBe(1)
  })

  it('serializes concurrent expo-sqlite queries through database lock', async () => {
    const order: number[] = []
    const getAllAsync = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('first')) {
        await new Promise((r) => setTimeout(r, 20))
        order.push(1)
        return []
      }
      order.push(2)
      return []
    })
    const runAsync = vi.fn()
    const wrapped = createSqlExecutor({ getAllAsync, runAsync })

    const p1 = wrapped.execute('SELECT 1 as first')
    const p2 = wrapped.execute('SELECT 2 as second')

    await Promise.all([p1, p2])
    expect(order).toEqual([1, 2])
  })
})
