import { describe, expect, it, vi } from 'vitest'
import { graphEdgeId, graphNodeIdForEntity } from '@baishou/shared'
import { GraphUpsertTool } from '../graph-upsert.tool'
import {
  VAULT,
  createGraphToolContext,
  createWriteRecorder
} from './graph-upsert.tool.test-helpers'

describe('GraphUpsertTool write semantics', () => {
  it('writes a content-addressable edge when both ends resolve', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const ming = graphNodeIdForEntity(VAULT, 'person', '小明')
    const hangzhou = graphNodeIdForEntity(VAULT, 'place', '杭州')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async (opts: { name: string }) => {
          if (opts.name === '小明') return { id: ming, name: '小明', nodeType: 'person' }
          if (opts.name === '杭州') return { id: hangzhou, name: '杭州', nodeType: 'place' }
          return null
        })
      }
    })

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
    // Gate 审批过的工具写入按 user 来源落盘，日记重新抽取不会把这条边标失效。
    expect(edges[0]!.record.origin).toBe('user')
    expect(edges[0]!.record.isCurrent).toBe(true)
    expect(edges[0]!.record.validTo).toBeNull()
  })

  it('updates an existing edge in place when identity stays the same', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const tombstones: string[] = []
    const ming = graphNodeIdForEntity(VAULT, 'person', '小明')
    const hangzhou = graphNodeIdForEntity(VAULT, 'place', '杭州')
    const edgeId = graphEdgeId(VAULT, ming, hangzhou, 'located_at', '2026-07-01')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord,
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
          createdAt: 100,
          isCurrent: false,
          validTo: 123456,
          origin: 'ai'
        }))
      }
    })

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
    // 显式更新一条已失效的边时，应恢复为当前边并升级为 user 来源。
    expect(edges[0]!.record.isCurrent).toBe(true)
    expect(edges[0]!.record.validTo).toBeNull()
    expect(edges[0]!.record.origin).toBe('user')
    expect(tombstones).toEqual([])
  })

  it('reports ambiguous edge endpoints instead of binding to the first same-name node', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const lattePerson = graphNodeIdForEntity(VAULT, 'person', 'Latte')
    const latteProduct = graphNodeIdForEntity(VAULT, 'product', 'Latte')
    const partner = graphNodeIdForEntity(VAULT, 'person', '伙伴')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord
      },
      graphNodeLookup: {
        findNodesByName: vi.fn(async (opts: { name: string }) => {
          if (opts.name === 'Latte') {
            return [
              { id: lattePerson, name: 'Latte', nodeType: 'person' },
              { id: latteProduct, name: 'Latte', nodeType: 'product' }
            ]
          }
          if (opts.name === '伙伴') {
            return [{ id: partner, name: '伙伴', nodeType: 'person' }]
          }
          return []
        }),
        findNodeByName: vi.fn(async () => null)
      }
    })

    const text = await tool.execute(
      {
        summary: '给 Latte 加关系',
        edges: [{ from: 'Latte', to: '伙伴', type: 'knows' }]
      },
      context
    )

    expect(writes.filter((w) => w.collection === 'edges')).toHaveLength(0)
    expect(text).toContain('reason=ambiguous_node')
    expect(text).toContain('Latte(person)')
    expect(text).toContain('Latte(product)')
  })

  it('uses from_type to disambiguate a same-name edge endpoint', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const lattePerson = graphNodeIdForEntity(VAULT, 'person', 'Latte')
    const latteProduct = graphNodeIdForEntity(VAULT, 'product', 'Latte')
    const partner = graphNodeIdForEntity(VAULT, 'person', '伙伴')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord
      },
      graphNodeLookup: {
        findNodesByName: vi.fn(async (opts: { name: string }) => {
          if (opts.name === 'Latte') {
            return [
              { id: lattePerson, name: 'Latte', nodeType: 'person' },
              { id: latteProduct, name: 'Latte', nodeType: 'product' }
            ]
          }
          if (opts.name === '伙伴') {
            return [{ id: partner, name: '伙伴', nodeType: 'person' }]
          }
          return []
        }),
        findNodeByName: vi.fn(async () => null)
      }
    })

    await tool.execute(
      {
        summary: '给 Latte 加关系',
        edges: [{ from: 'Latte', from_type: 'person', to: '伙伴', type: 'knows' }]
      },
      context
    )

    const edges = writes.filter((w) => w.collection === 'edges')
    expect(edges).toHaveLength(1)
    expect(edges[0]!.record.fromId).toBe(lattePerson)
  })

  it('deletes the old edge together when type changes', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const deleted: Array<{ kind: string; id: string }> = []
    const tombstone = vi.fn()
    const ming = graphNodeIdForEntity(VAULT, 'person', '小明')
    const hangzhou = graphNodeIdForEntity(VAULT, 'place', '杭州')
    const oldId = graphEdgeId(VAULT, ming, hangzhou, 'located_at', '2026-07-01')
    const newId = graphEdgeId(VAULT, ming, hangzhou, 'visited', '2026-07-01')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      deleteGraphRecord: vi.fn(async (input: { kind: 'node' | 'edge'; id: string }) => {
        deleted.push(input)
      }),
      rawDataSourceManager: {
        writeRecord,
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
    })

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
    const { writes, writeRecord } = createWriteRecorder()
    const tombstones: string[] = []
    const ming = graphNodeIdForEntity(VAULT, 'person', '小明')
    const hangzhou = graphNodeIdForEntity(VAULT, 'place', '杭州')
    const oldId = graphEdgeId(VAULT, ming, hangzhou, 'located_at', '2026-07-01')
    const newId = graphEdgeId(VAULT, ming, hangzhou, 'visited', '2026-07-01')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord,
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
    })

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

  it('resolves validFrom independently for edge with its own source_ref', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const ming = graphNodeIdForEntity(VAULT, 'person', '小明')
    const hangzhou = graphNodeIdForEntity(VAULT, 'place', '杭州')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async (query: { name: string }) => {
          if (query.name === '小明') return { id: ming, name: '小明', nodeType: 'person' }
          if (query.name === '杭州') return { id: hangzhou, name: '杭州', nodeType: 'place' }
          return null
        })
      }
    })

    await tool.execute(
      {
        summary: '按指定日期写入关系',
        edges: [
          {
            from: '小明',
            to: '杭州',
            type: 'located_at',
            source_ref: '2026-05-20'
          }
        ],
        source_ref: '2026-08-01'
      } as never,
      context
    )

    const edges = writes.filter((w) => w.collection === 'edges')
    expect(edges).toHaveLength(1)
    expect(edges[0]!.record.sourceRef).toBe('2026-05-20')
    expect(edges[0]!.record.sourceKind).toBe('diary')
    const may20Ms = new Date('2026-05-20T00:00:00').getTime()
    expect(Math.abs((edges[0]!.record.validFrom ?? 0) - may20Ms)).toBeLessThan(86400000 * 2)
  })
})
