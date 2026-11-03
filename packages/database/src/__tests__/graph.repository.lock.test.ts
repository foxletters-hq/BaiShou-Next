import { describe, it, expect, vi } from 'vitest'
import { GraphRepository } from '../repositories/graph.repository'
import type { AppDatabase } from '../types'

describe('GraphRepository lock & retry', () => {
  it('retries when query throws database is locked error', async () => {
    let selectCalls = 0
    const mockDb = {
      session: { client: { prepareSync: vi.fn() } },
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            selectCalls++
            if (selectCalls === 1) {
              throw new Error(
                "Call to function 'NativeStatement.finalizeAsync' has been rejected.\n→ Caused by: Error code : database is locked"
              )
            }
            return Promise.resolve([])
          })
        })
      }))
    } as unknown as AppDatabase

    const repo = new GraphRepository(mockDb)
    const result = await repo.findNodesByNameOrAlias('vault-1', 'test')
    // 1st attempt: 1st select fails.
    // 2nd attempt (retry): 1st select succeeds, 2nd select (aliases) succeeds -> total 3 select calls
    expect(selectCalls).toBe(3)
    expect(result).toEqual([])
  })

  it('serializes concurrent graph operations through database lock', async () => {
    let inFlight = 0
    let hasOverlap = false

    const mockDb = {
      session: { client: { prepareSync: vi.fn() } },
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(async () => {
            inFlight++
            if (inFlight > 1) {
              hasOverlap = true
            }
            await new Promise((r) => setTimeout(r, 10))
            inFlight--
            return []
          })
        })
      }))
    } as unknown as AppDatabase

    const repo = new GraphRepository(mockDb)
    const p1 = repo.findNodesByNameOrAlias('vault-1', 'node-1')
    const p2 = repo.findNodesByNameOrAlias('vault-1', 'node-2')

    await Promise.all([p1, p2])
    expect(hasOverlap).toBe(false)
  })
})
