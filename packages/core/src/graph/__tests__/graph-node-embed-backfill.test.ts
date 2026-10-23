import { describe, expect, it } from 'vitest'
import {
  backfillUnembeddedGraphNodes,
  EMBED_API_UNAVAILABLE,
  isEmbedApiUnavailableError
} from '../graph-node-embed-backfill'

describe('backfillUnembeddedGraphNodes', () => {
  it('reports progress for success and failed nodes', async () => {
    const ticks: Array<{ completed: number; updated: number }> = []
    const result = await backfillUnembeddedGraphNodes({
      vaultId: 'v1',
      modelId: 'm1',
      listUnembeddedLiveNodes: async () => [
        { id: 'a', name: '甲', summary: 's' },
        { id: 'b', name: '', summary: '' },
        { id: 'c', name: '乙', summary: 's' }
      ],
      updateNodeEmbedding: async () => {},
      embedQuery: async (text) => (text.includes('乙') ? null : [1, 2]),
      onProgress: (progress) =>
        ticks.push({ completed: progress.completed, updated: progress.updated })
    })
    expect(result).toEqual({ updated: 1, failed: 2, total: 3 })
    expect(ticks).toEqual([
      { completed: 1, updated: 1 },
      { completed: 2, updated: 1 },
      { completed: 3, updated: 1 }
    ])
  })

  it('stops before remaining nodes when onBeforeItem throws', async () => {
    let embedCalls = 0
    await expect(
      backfillUnembeddedGraphNodes({
        vaultId: 'v1',
        modelId: 'm1',
        listUnembeddedLiveNodes: async () => [
          { id: 'a', name: '甲', summary: 's' },
          { id: 'b', name: '乙', summary: 's' }
        ],
        updateNodeEmbedding: async () => {},
        embedQuery: async () => {
          embedCalls += 1
          return [1]
        },
        onBeforeItem: async () => {
          if (embedCalls >= 1) throw new Error('BATCH_EMBED_ABORTED')
        }
      })
    ).rejects.toThrow('BATCH_EMBED_ABORTED')
    expect(embedCalls).toBe(1)
  })

  it('should stop when embedQuery returns null three times in a row', async () => {
    let embedCalls = 0
    await expect(
      backfillUnembeddedGraphNodes({
        vaultId: 'v1',
        modelId: 'm1',
        listUnembeddedLiveNodes: async () => [
          { id: 'a', name: '甲', summary: 's' },
          { id: 'b', name: '乙', summary: 's' },
          { id: 'c', name: '丙', summary: 's' },
          { id: 'd', name: '丁', summary: 's' }
        ],
        updateNodeEmbedding: async () => {},
        embedQuery: async () => {
          embedCalls += 1
          return null
        }
      })
    ).rejects.toThrow(/EMBED_API_UNAVAILABLE/)
    expect(embedCalls).toBe(3)
  })

  it('returns zeros when modelId is empty', async () => {
    const result = await backfillUnembeddedGraphNodes({
      vaultId: 'v1',
      modelId: '  ',
      listUnembeddedLiveNodes: async () => [{ id: 'a', name: '甲', summary: '' }],
      updateNodeEmbedding: async () => {},
      embedQuery: async () => [1]
    })
    expect(result).toEqual({ updated: 0, failed: 0, total: 0 })
  })

  it('should recognize consecutive embed API failures', () => {
    expect(isEmbedApiUnavailableError(new Error(`${EMBED_API_UNAVAILABLE}: stopped`))).toBe(true)
    expect(isEmbedApiUnavailableError(new Error('other'))).toBe(false)
    expect(isEmbedApiUnavailableError('EMBED_API_UNAVAILABLE')).toBe(false)
  })

  it('batches embedding requests, deduplicates identical card texts, and flushes DB updates in batch', async () => {
    const batchTexts: string[][] = []
    const dbBatches: Array<Array<{ id: string; embedding: number[] }>> = []
    const result = await backfillUnembeddedGraphNodes({
      vaultId: 'v1',
      modelId: 'm1',
      concurrency: 10,
      listUnembeddedLiveNodes: async () => [
        { id: 'n1', name: '甲', summary: '同事' },
        { id: 'n2', name: '甲', summary: '同事' },
        { id: 'n3', name: '乙', summary: '朋友' }
      ],
      updateNodeEmbedding: async () => {},
      updateNodeEmbeddingsBatch: async (_vid, _modelId, items) => {
        dbBatches.push(items)
      },
      embedQuery: async () => [9, 9],
      embedBatch: async (texts) => {
        batchTexts.push(texts)
        return texts.map((_, idx) => [idx + 1, idx + 2])
      }
    })
    expect(result).toEqual({ updated: 3, failed: 0, total: 3 })
    expect(batchTexts).toHaveLength(1)
    expect(batchTexts[0]).toHaveLength(2)
    expect(dbBatches).toHaveLength(1)
    expect(dbBatches[0]).toEqual([
      { id: 'n1', embedding: [1, 2] },
      { id: 'n2', embedding: [1, 2] },
      { id: 'n3', embedding: [2, 3] }
    ])
  })
})
