import { describe, expect, it, vi } from 'vitest'
import {
  mergeDiaryGraphNodeGroup,
  mergeDiaryGraphNodes,
  syncDiaryGraphMergeGroupIntoIndex,
  syncDiaryGraphMergeIntoIndex
} from '../graph-merge-nodes'

describe('mergeDiaryGraphNodes', () => {
  it('writes survivor aliases, remaps edges, and removes the loser from its shard', async () => {
    const writes: Array<{ collection?: string; record: Record<string, unknown> }> = []
    const removed: Array<{ collection: string; shardMonth: string; ids: readonly string[] }> = []
    const manager = {
      writeRecord: vi.fn(async (record: Record<string, unknown>, opts: { collection: string }) => {
        writes.push({ collection: opts.collection, record })
      }),
      removeRecordsFromShard: vi.fn(
        async (collection: 'nodes' | 'edges', shardMonth: string, ids: readonly string[]) => {
          removed.push({ collection, shardMonth, ids })
          return ids.length
        }
      )
    }
    const repo = {
      getNodeById: vi.fn(async (id: string) => {
        if (id === 'surv') {
          return {
            id: 'surv',
            vaultId: 'v1',
            nodeType: 'person',
            name: '张三',
            aliases: ['张三'],
            summary: '',
            propsJson: '{}',
            mentionCount: 2,
            firstSeenAt: 10,
            lastSeenAt: 20,
            origin: 'ai',
            shardMonth: '2026-01',
            reviewStatus: 'approved',
            createdAt: 10
          }
        }
        if (id === 'lose') {
          return {
            id: 'lose',
            vaultId: 'v1',
            nodeType: 'person',
            name: '小张',
            aliases: ['小张'],
            summary: '',
            propsJson: '{}',
            mentionCount: 1,
            firstSeenAt: 5,
            lastSeenAt: 15,
            origin: 'ai',
            shardMonth: '2026-02',
            reviewStatus: 'pending',
            createdAt: 5
          }
        }
        return null
      }),
      listEdgesTouching: vi.fn(async () => [
        {
          id: 'e1',
          vaultId: 'v1',
          fromId: 'lose',
          toId: 'place-1',
          edgeType: 'located_at',
          propsJson: '{}',
          validFrom: 10,
          validTo: null,
          isCurrent: true,
          sourceKind: 'diary',
          sourceRef: '2026-02-01',
          sourceExcerpt: '',
          sourceContentHash: null,
          confidence: 80,
          origin: 'ai',
          reviewStatus: 'pending',
          shardMonth: '2026-02',
          createdAt: 10
        }
      ])
    }

    await mergeDiaryGraphNodes({
      vaultId: 'v1',
      vaultName: 'Personal',
      survivorId: 'surv',
      loserId: 'lose',
      reason: 'same-person',
      now: 100,
      manager: manager as never,
      repo: repo as never
    })

    const survivor = writes.find((w) => w.collection === 'nodes' && w.record.id === 'surv')
    const loser = writes.find((w) => w.collection === 'nodes' && w.record.id === 'lose')
    const edge = writes.find((w) => w.collection === 'edges' && w.record.id === 'e1')
    expect(survivor?.record.aliases).toEqual(expect.arrayContaining(['张三', '小张']))
    expect(survivor?.record.mentionCount).toBe(3)
    expect(survivor?.record.firstSeenAt).toBe(5)
    expect(edge?.record.fromId).toBe('surv')
    expect(edge?.record.toId).toBe('place-1')
    expect(edge?.record.deletedAt).toBeNull()
    expect(loser).toBeUndefined()
    expect(removed).toEqual([{ collection: 'nodes', shardMonth: '2026-02', ids: ['lose'] }])
  })

  it('indexes remapped rows then soft-deletes the loser in SQLite', async () => {
    const order: string[] = []
    await syncDiaryGraphMergeIntoIndex({
      loserId: 'lose',
      syncPendingIndex: async (opts) => {
        order.push(`sync:${opts?.absentSweep ?? 'default'}`)
      },
      softDeleteNode: async (id) => {
        order.push(`soft:${id}`)
      }
    })
    expect(order).toEqual(['sync:off', 'soft:lose'])
  })

  it('rejects merging different node types', async () => {
    await expect(
      mergeDiaryGraphNodes({
        vaultId: 'v1',
        vaultName: 'Personal',
        survivorId: 'surv',
        loserId: 'lose',
        manager: {
          writeRecord: vi.fn(),
          removeRecordsFromShard: vi.fn()
        } as never,
        repo: {
          getNodeById: vi.fn(async (id: string) =>
            id === 'surv'
              ? {
                  id: 'surv',
                  vaultId: 'v1',
                  nodeType: 'person',
                  name: '张三',
                  aliases: [],
                  summary: '',
                  mentionCount: 1,
                  firstSeenAt: 1,
                  lastSeenAt: 1,
                  origin: 'ai',
                  shardMonth: '2026-01',
                  createdAt: 1
                }
              : {
                  id: 'lose',
                  vaultId: 'v1',
                  nodeType: 'topic',
                  name: '张三',
                  aliases: [],
                  summary: '',
                  mentionCount: 1,
                  firstSeenAt: 1,
                  lastSeenAt: 1,
                  origin: 'ai',
                  shardMonth: '2026-01',
                  createdAt: 1
                }
          ),
          listEdgesTouching: vi.fn(async () => [])
        } as never
      })
    ).rejects.toThrow('只能合并同一类型的节点')
  })

  it('merges several losers then soft-deletes them after one index sync', async () => {
    const removed: string[] = []
    const repo = {
      getNodeById: vi.fn(async (id: string) => ({
        id,
        vaultId: 'v1',
        nodeType: 'person',
        name: id === 'surv' ? '张三' : id,
        aliases: [],
        summary: '',
        mentionCount: 1,
        firstSeenAt: 1,
        lastSeenAt: 1,
        origin: 'ai',
        shardMonth: '2026-01',
        createdAt: 1
      })),
      listEdgesTouching: vi.fn(async () => [])
    }
    const manager = {
      writeRecord: vi.fn(),
      removeRecordsFromShard: vi.fn(async (_c: string, _m: string, ids: readonly string[]) => {
        removed.push(...ids)
        return ids.length
      })
    }
    const result = await mergeDiaryGraphNodeGroup({
      vaultId: 'v1',
      vaultName: 'Personal',
      survivorId: 'surv',
      loserIds: ['lose1', 'lose2'],
      manager: manager as never,
      repo: repo as never
    })
    expect(result.loserIds).toEqual(['lose1', 'lose2'])
    expect(removed).toEqual(['lose1', 'lose2'])

    const order: string[] = []
    await syncDiaryGraphMergeGroupIntoIndex({
      loserIds: ['lose1', 'lose2'],
      syncPendingIndex: async (opts) => {
        order.push(`sync:${opts?.absentSweep ?? 'default'}`)
      },
      softDeleteNode: async (id) => {
        order.push(`soft:${id}`)
      }
    })
    expect(order).toEqual(['sync:off', 'soft:lose1', 'soft:lose2'])
  })
})
