import { describe, expect, it, vi } from 'vitest'
import { clearLifeGraphData } from '../clear-life-graph'

describe('clearLifeGraphData', () => {
  it('stops extract, deletes vault rows, wipes shards, then clears marks', async () => {
    const order: string[] = []
    const graphRepo = {
      deleteAllForVault: vi.fn(async (vaultId: string) => {
        expect(vaultId).toBe('vlt_a')
        order.push('sqlite')
      })
    }
    const graphManager = {
      wipeAllCollections: vi.fn(async () => {
        order.push('jsonl')
        return 3
      })
    }
    const freshness = {
      clearReextractMarks: vi.fn(() => {
        order.push('marks')
      })
    }
    const result = await clearLifeGraphData({
      vaultId: ' vlt_a ',
      graphRepo,
      graphManager: graphManager as never,
      freshness: freshness as never,
      stopExtract: () => {
        order.push('stop')
      }
    })
    expect(result).toEqual({ shardCount: 3 })
    expect(order).toEqual(['stop', 'sqlite', 'jsonl', 'marks'])
  })

  it('rejects an empty vault id', async () => {
    await expect(
      clearLifeGraphData({
        vaultId: '  ',
        graphRepo: { deleteAllForVault: vi.fn() },
        graphManager: { wipeAllCollections: vi.fn() } as never
      })
    ).rejects.toThrow(/vaultId/)
  })
})
