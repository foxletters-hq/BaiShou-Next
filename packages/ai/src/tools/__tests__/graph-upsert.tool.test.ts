import { describe, expect, it, vi } from 'vitest'
import { graphEdgeId, graphNodeIdForEntity } from '@baishou/shared'
import { GraphUpsertTool } from '../graph-upsert.tool'
import type { ToolContext } from '../agent.tool'

const VAULT = 'vlt_aaaaaaaaaaaaaaaa'

describe('GraphUpsertTool write semantics', () => {
  it('reuses existing 小明 and skips edges whose endpoints cannot be resolved', async () => {
    const writes: Array<{ collection?: string; record: { id: string; fromId?: string; toId?: string; name?: string; mentionCount?: number } }> =
      []
    const existingId = graphNodeIdForEntity(VAULT, 'person', '小明')
    const tool = new GraphUpsertTool()
    const context = {
      vaultId: VAULT,
      vaultName: 'Personal',
      rawDataSourceManager: {
        writeRecord: vi.fn(async (_kind: string, record: { id: string }, opts?: { collection?: string }) => {
          writes.push({ collection: opts?.collection, record: record as never })
        })
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async (opts: { name: string; nodeType?: string }) => {
          if (opts.name === '小明' || opts.name.includes('小明')) {
            return {
              id: existingId,
              name: '小明',
              nodeType: 'person',
              aliases: ['小明同学'],
              mentionCount: 4,
              firstSeenAt: 100,
              createdAt: 100,
              shardMonth: '2026-01'
            }
          }
          return null
        })
      }
    } as unknown as ToolContext

    const text = await tool.execute(
      {
        summary: '记一次见面',
        entities: JSON.stringify([{ name: '小明', type: 'person' }]),
        edges: JSON.stringify([
          { from: '小明', to: '不存在的人', type: 'relates_to' },
          { from: '小明', to: '杭州', type: 'located_at' }
        ]),
        source_ref: '2026-07-01'
      },
      context
    )

    const nodes = writes.filter((w) => w.collection === 'nodes')
    const edges = writes.filter((w) => w.collection === 'edges')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.record.id).toBe(existingId)
    expect(nodes[0]!.record.mentionCount).toBe(4)
    expect(edges).toHaveLength(0)
    expect(text).toContain('跳过 2')
  })

  it('writes a content-addressable edge when both ends resolve', async () => {
    const writes: Array<{ collection?: string; record: { id: string; fromId?: string; toId?: string; validFrom?: number; shardMonth?: string } }> =
      []
    const ming = graphNodeIdForEntity(VAULT, 'person', '小明')
    const hangzhou = graphNodeIdForEntity(VAULT, 'place', '杭州')
    const tool = new GraphUpsertTool()
    const context = {
      vaultId: VAULT,
      vaultName: 'Personal',
      rawDataSourceManager: {
        writeRecord: vi.fn(async (_kind: string, record: { id: string }, opts?: { collection?: string }) => {
          writes.push({ collection: opts?.collection, record: record as never })
        })
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async (opts: { name: string }) => {
          if (opts.name === '小明') return { id: ming, name: '小明', nodeType: 'person' }
          if (opts.name === '杭州') return { id: hangzhou, name: '杭州', nodeType: 'place' }
          return null
        })
      }
    } as unknown as ToolContext

    await tool.execute(
      {
        summary: '去杭州',
        entities: JSON.stringify([
          { name: '小明', type: 'person' },
          { name: '杭州', type: 'place' }
        ]),
        edges: JSON.stringify([{ from: '小明', to: '杭州', type: 'located_at' }]),
        source_ref: '2026-07-01'
      },
      context
    )

    const edges = writes.filter((w) => w.collection === 'edges')
    expect(edges).toHaveLength(1)
    expect(edges[0]!.record.id).toBe(graphEdgeId(VAULT, ming, hangzhou, 'located_at', '2026-07-01'))
    expect(edges[0]!.record.fromId).toBe(ming)
    expect(edges[0]!.record.toId).toBe(hangzhou)
    expect(edges[0]!.record.shardMonth).toBe('2026-07')
    expect(edges[0]!.record.validFrom).toBe(new Date(2026, 6, 1).getTime())
  })

  it('accepts native entity/edge arrays', async () => {
    const writes: Array<{ collection?: string }> = []
    const ming = graphNodeIdForEntity(VAULT, 'person', '小明')
    const hangzhou = graphNodeIdForEntity(VAULT, 'place', '杭州')
    const tool = new GraphUpsertTool()
    const context = {
      vaultId: VAULT,
      vaultName: 'Personal',
      rawDataSourceManager: {
        writeRecord: vi.fn(async (_kind: string, _record: { id: string }, opts?: { collection?: string }) => {
          writes.push({ collection: opts?.collection })
        })
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async (opts: { name: string }) => {
          if (opts.name === '小明') return { id: ming, name: '小明', nodeType: 'person' }
          if (opts.name === '杭州') return { id: hangzhou, name: '杭州', nodeType: 'place' }
          return null
        })
      }
    } as unknown as ToolContext

    const text = await tool.execute(
      {
        summary: '去杭州',
        entities: [
          { name: '小明', type: 'person' },
          { name: '杭州', type: 'place' }
        ],
        edges: [{ from: '小明', to: '杭州', type: 'located_at' }],
        source_ref: '2026-07-01'
      } as never,
      context
    )

    expect(writes.filter((w) => w.collection === 'nodes')).toHaveLength(2)
    expect(writes.filter((w) => w.collection === 'edges')).toHaveLength(1)
    expect(text).toContain('已写入人生关系图')
  })

  it('does not reuse a node when findNodeByName returns null (no fuzzy host hit)', async () => {
    const writes: Array<{ collection?: string; record: { id: string; name?: string } }> = []
    const tool = new GraphUpsertTool()
    const context = {
      vaultId: VAULT,
      vaultName: 'Personal',
      rawDataSourceManager: {
        writeRecord: vi.fn(async (_kind: string, record: { id: string }, opts?: { collection?: string }) => {
          writes.push({ collection: opts?.collection, record: record as never })
        })
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async () => null)
      }
    } as unknown as ToolContext

    await tool.execute(
      {
        summary: '记下小明同学',
        entities: JSON.stringify([{ name: '小明同学', type: 'person' }])
      },
      context
    )

    const nodes = writes.filter((w) => w.collection === 'nodes')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.record.id).toBe(graphNodeIdForEntity(VAULT, 'person', '小明同学'))
  })

  it('keeps origin=user when reusing a hand-edited node', async () => {
    const writes: Array<{ collection?: string; record: { origin?: string } }> = []
    const existingId = graphNodeIdForEntity(VAULT, 'person', '小明')
    const tool = new GraphUpsertTool()
    const context = {
      vaultId: VAULT,
      vaultName: 'Personal',
      rawDataSourceManager: {
        writeRecord: vi.fn(async (_kind: string, record: { id: string }, opts?: { collection?: string }) => {
          writes.push({ collection: opts?.collection, record: record as never })
        })
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async () => ({
          id: existingId,
          name: '小明',
          nodeType: 'person',
          origin: 'user' as const
        }))
      }
    } as unknown as ToolContext

    await tool.execute(
      {
        summary: '补一条关系',
        entities: JSON.stringify([{ name: '小明', type: 'person' }])
      },
      context
    )

    const nodes = writes.filter((w) => w.collection === 'nodes')
    expect(nodes[0]!.record.origin).toBe('user')
  })

  it('writes reviewStatus approved so the change is visible immediately', async () => {
    const writes: Array<{ collection?: string; record: { reviewStatus?: string } }> = []
    const tool = new GraphUpsertTool()
    const context = {
      vaultId: VAULT,
      vaultName: 'Personal',
      rawDataSourceManager: {
        writeRecord: vi.fn(async (_kind: string, record: { id: string }, opts?: { collection?: string }) => {
          writes.push({ collection: opts?.collection, record: record as never })
        })
      }
    } as unknown as ToolContext

    const text = await tool.execute(
      {
        summary: '记一个人',
        entities: JSON.stringify([{ name: '小红', type: 'person' }])
      },
      context
    )
    expect(writes[0]!.record.reviewStatus).toBe('approved')
    expect(text).toContain('已生效')
  })

  it('does not switch an explicit node id to another node found by name', async () => {
    const writes: Array<{ collection?: string; record: { id: string; name?: string } }> = []
    const colleagueId = graphNodeIdForEntity(VAULT, 'person', '同事小明')
    const cousinId = graphNodeIdForEntity(VAULT, 'person', '小明')
    const tool = new GraphUpsertTool()
    const context = {
      vaultId: VAULT,
      vaultName: 'Personal',
      rawDataSourceManager: {
        writeRecord: vi.fn(async (_kind: string, record: { id: string }, opts?: { collection?: string }) => {
          writes.push({ collection: opts?.collection, record: record as never })
        })
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async () => ({
          id: cousinId,
          name: '小明',
          nodeType: 'person'
        })),
        findNodeById: vi.fn(async (id: string) =>
          id === colleagueId
            ? { id: colleagueId, name: '同事小明', nodeType: 'person' }
            : null
        )
      }
    } as unknown as ToolContext

    await tool.execute(
      {
        summary: '补同事摘要',
        entities: JSON.stringify([{ id: colleagueId, name: '小明', type: 'person', summary: '同事' }])
      },
      context
    )

    const nodes = writes.filter((w) => w.collection === 'nodes')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.record.id).toBe(colleagueId)
    expect(nodes[0]!.record.name).toBe('同事小明')
  })

  it('updates an existing edge in place when identity stays the same', async () => {
    const writes: Array<{ collection?: string; record: { id: string; sourceExcerpt?: string } }> = []
    const tombstones: string[] = []
    const ming = graphNodeIdForEntity(VAULT, 'person', '小明')
    const hangzhou = graphNodeIdForEntity(VAULT, 'place', '杭州')
    const edgeId = graphEdgeId(VAULT, ming, hangzhou, 'located_at', '2026-07-01')
    const tool = new GraphUpsertTool()
    const context = {
      vaultId: VAULT,
      vaultName: 'Personal',
      rawDataSourceManager: {
        writeRecord: vi.fn(async (_kind: string, record: { id: string }, opts?: { collection?: string }) => {
          writes.push({ collection: opts?.collection, record: record as never })
        }),
        tombstone: vi.fn(async (_kind: string, id: string) => {
          tombstones.push(id)
        })
      },
      graphEdgeLookup: {
        findEdgeById: vi.fn(async () => ({
          id: edgeId,
          fromId: ming,
          toId: hangzhou,
          edgeType: 'located_at',
          sourceRef: '2026-07-01',
          sourceExcerpt: '旧摘录',
          shardMonth: '2026-07',
          createdAt: 100
        }))
      }
    } as unknown as ToolContext

    await tool.execute(
      {
        summary: '改摘录',
        edges: [{ id: edgeId, action: 'update', excerpt: '新摘录' }],
        source_ref: '2026-07-01'
      } as never,
      context
    )

    const edges = writes.filter((w) => w.collection === 'edges')
    expect(edges).toHaveLength(1)
    expect(edges[0]!.record.id).toBe(edgeId)
    expect(edges[0]!.record.sourceExcerpt).toBe('新摘录')
    expect(tombstones).toEqual([])
  })

  it('deletes the old edge together when type changes', async () => {
    const writes: Array<{ collection?: string; record: { id: string; edgeType?: string } }> = []
    const deleted: Array<{ kind: string; id: string }> = []
    const tombstone = vi.fn()
    const ming = graphNodeIdForEntity(VAULT, 'person', '小明')
    const hangzhou = graphNodeIdForEntity(VAULT, 'place', '杭州')
    const oldId = graphEdgeId(VAULT, ming, hangzhou, 'located_at', '2026-07-01')
    const newId = graphEdgeId(VAULT, ming, hangzhou, 'visited', '2026-07-01')
    const tool = new GraphUpsertTool()
    const context = {
      vaultId: VAULT,
      vaultName: 'Personal',
      deleteGraphRecord: vi.fn(async (input: { kind: 'node' | 'edge'; id: string }) => {
        deleted.push(input)
      }),
      rawDataSourceManager: {
        writeRecord: vi.fn(async (_kind: string, record: { id: string }, opts?: { collection?: string }) => {
          writes.push({ collection: opts?.collection, record: record as never })
        }),
        tombstone
      },
      graphEdgeLookup: {
        findEdgeById: vi.fn(async () => ({
          id: oldId,
          fromId: ming,
          toId: hangzhou,
          edgeType: 'located_at',
          sourceRef: '2026-07-01',
          shardMonth: '2026-07',
          createdAt: 100
        }))
      }
    } as unknown as ToolContext

    await tool.execute(
      {
        summary: '改关系类型',
        edges: [{ id: oldId, action: 'update', type: 'visited' }],
        source_ref: '2026-07-01'
      } as never,
      context
    )

    expect(deleted).toEqual([{ kind: 'edge', id: oldId }])
    expect(tombstone).not.toHaveBeenCalled()
    const edges = writes.filter((w) => w.collection === 'edges')
    expect(edges[0]!.record.id).toBe(newId)
    expect(edges[0]!.record.edgeType).toBe('visited')
  })

  it('tombstones the old edge when type changes without deleteGraphRecord', async () => {
    const writes: Array<{ collection?: string; record: { id: string; edgeType?: string } }> = []
    const tombstones: string[] = []
    const ming = graphNodeIdForEntity(VAULT, 'person', '小明')
    const hangzhou = graphNodeIdForEntity(VAULT, 'place', '杭州')
    const oldId = graphEdgeId(VAULT, ming, hangzhou, 'located_at', '2026-07-01')
    const newId = graphEdgeId(VAULT, ming, hangzhou, 'visited', '2026-07-01')
    const tool = new GraphUpsertTool()
    const context = {
      vaultId: VAULT,
      vaultName: 'Personal',
      rawDataSourceManager: {
        writeRecord: vi.fn(async (_kind: string, record: { id: string }, opts?: { collection?: string }) => {
          writes.push({ collection: opts?.collection, record: record as never })
        }),
        tombstone: vi.fn(async (_kind: string, id: string) => {
          tombstones.push(id)
        })
      },
      graphEdgeLookup: {
        findEdgeById: vi.fn(async () => ({
          id: oldId,
          fromId: ming,
          toId: hangzhou,
          edgeType: 'located_at',
          sourceRef: '2026-07-01',
          shardMonth: '2026-07',
          createdAt: 100
        }))
      }
    } as unknown as ToolContext

    await tool.execute(
      {
        summary: '改关系类型',
        edges: [{ id: oldId, action: 'update', type: 'visited' }],
        source_ref: '2026-07-01'
      } as never,
      context
    )

    expect(tombstones).toEqual([oldId])
    const edges = writes.filter((w) => w.collection === 'edges')
    expect(edges[0]!.record.id).toBe(newId)
    expect(edges[0]!.record.edgeType).toBe('visited')
  })

  it('deletes an edge by id together with the file layer', async () => {
    const deleted: Array<{ kind: string; id: string }> = []
    const tombstone = vi.fn()
    const syncGraphPendingIndex = vi.fn()
    const tool = new GraphUpsertTool()
    const context = {
      vaultId: VAULT,
      vaultName: 'Personal',
      deleteGraphRecord: vi.fn(async (input: { kind: 'node' | 'edge'; id: string }) => {
        deleted.push(input)
      }),
      syncGraphPendingIndex,
      rawDataSourceManager: {
        writeRecord: vi.fn(),
        tombstone
      },
      graphEdgeLookup: {
        findEdgeById: vi.fn(async () => ({
          id: 'edge-1',
          fromId: 'a',
          toId: 'b',
          edgeType: 'knows',
          shardMonth: '2026-07'
        }))
      }
    } as unknown as ToolContext

    const text = await tool.execute(
      {
        summary: '删错边',
        edges: [{ id: 'edge-1', action: 'delete' }]
      } as never,
      context
    )

    expect(deleted).toEqual([{ kind: 'edge', id: 'edge-1' }])
    expect(tombstone).not.toHaveBeenCalled()
    expect(syncGraphPendingIndex).not.toHaveBeenCalled()
    expect(text).toContain('删边 1')
    expect(text).toContain('文件层与本地索引已一并删除')
  })

  it('falls back to tombstone when deleteGraphRecord is missing', async () => {
    const tombstones: string[] = []
    const syncGraphPendingIndex = vi.fn()
    const tool = new GraphUpsertTool()
    const context = {
      vaultId: VAULT,
      vaultName: 'Personal',
      syncGraphPendingIndex,
      rawDataSourceManager: {
        writeRecord: vi.fn(),
        tombstone: vi.fn(async (_kind: string, id: string) => {
          tombstones.push(id)
        })
      },
      graphEdgeLookup: {
        findEdgeById: vi.fn(async () => ({
          id: 'edge-1',
          fromId: 'a',
          toId: 'b',
          edgeType: 'knows',
          shardMonth: '2026-07'
        }))
      }
    } as unknown as ToolContext

    const text = await tool.execute(
      {
        summary: '删错边',
        edges: [{ id: 'edge-1', action: 'delete' }]
      } as never,
      context
    )

    expect(tombstones).toEqual(['edge-1'])
    expect(syncGraphPendingIndex).toHaveBeenCalledTimes(1)
    expect(text).toContain('删边 1')
  })
})
