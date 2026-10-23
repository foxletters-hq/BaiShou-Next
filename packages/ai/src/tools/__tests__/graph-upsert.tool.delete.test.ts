import { describe, expect, it, vi } from 'vitest'
import { graphNodeIdForEntity } from '@baishou/shared'
import { GraphUpsertTool } from '../graph-upsert.tool'
import {
  VAULT,
  createGraphToolContext,
  createWriteRecorder
} from './graph-upsert.tool.test-helpers'

describe('GraphUpsertTool write semantics', () => {
  it('does not switch an explicit node id to another node found by name', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const colleagueId = graphNodeIdForEntity(VAULT, 'person', '同事小明')
    const cousinId = graphNodeIdForEntity(VAULT, 'person', '小明')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async () => ({
          id: cousinId,
          name: '小明',
          nodeType: 'person'
        })),
        findNodeById: vi.fn(async (id: string) =>
          id === colleagueId ? { id: colleagueId, name: '同事小明', nodeType: 'person' } : null
        )
      }
    })

    await tool.execute(
      {
        summary: '补同事摘要',
        entities: JSON.stringify([
          { id: colleagueId, name: '小明', type: 'person', summary: '同事' }
        ])
      },
      context
    )

    const nodes = writes.filter((w) => w.collection === 'nodes')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.record.id).toBe(colleagueId)
    expect(nodes[0]!.record.name).toBe('同事小明')
  })

  it('deletes an edge by id together with the file layer', async () => {
    const deleted: Array<{ kind: string; id: string }> = []
    const tombstone = vi.fn()
    const syncGraphPendingIndex = vi.fn()
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
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
    })

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
    const context = createGraphToolContext({
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
    })

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

  it('should not count a missing edge id as deleted', async () => {
    const deleted: Array<{ kind: string; id: string }> = []
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      deleteGraphRecord: vi.fn(async (input: { kind: 'node' | 'edge'; id: string }) => {
        deleted.push(input)
      }),
      rawDataSourceManager: {
        writeRecord: vi.fn(),
        tombstone: vi.fn()
      },
      graphEdgeLookup: {
        findEdgeById: vi.fn(async () => null)
      }
    })

    const text = await tool.execute(
      {
        summary: '删不存在的边',
        edges: [{ id: 'edge_test_nonexistent_000', action: 'delete' }]
      } as never,
      context
    )

    expect(deleted).toEqual([])
    expect(text).not.toContain('删边')
    expect(text).not.toContain('文件层')
    expect(text).toContain('reason=not_found')
    expect(text).toContain('id=edge_test_nonexistent_000')
  })

  it('should skip update and delete when edge id is missing', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord,
        tombstone: vi.fn()
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async (opts: { name: string }) => {
          if (opts.name === '测试人物A') return { id: 'n1', name: '测试人物A', nodeType: 'person' }
          if (opts.name === '测试地点B') return { id: 'n2', name: '测试地点B', nodeType: 'place' }
          return null
        })
      }
    })

    const text = await tool.execute(
      {
        summary: '无 id 改删',
        edges: [
          { from: '测试人物A', to: '测试地点B', type: '工作于', action: 'update' },
          { from: '测试人物A', to: '测试地点B', type: '工作于', action: 'delete' }
        ]
      } as never,
      context
    )

    expect(writes.filter((w) => w.collection === 'edges')).toHaveLength(0)
    expect(text).toContain('reason=missing_id')
    expect(text).not.toContain('改边')
    expect(text).not.toContain('删边')
  })

  it('deletes a node by id together with the file layer and reports deleted count', async () => {
    const deleted: Array<{ kind: string; id: string }> = []
    const tombstone = vi.fn()
    const nodeId = graphNodeIdForEntity(VAULT, 'person', '临时人物')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      deleteGraphRecord: vi.fn(async (input: { kind: 'node' | 'edge'; id: string }) => {
        deleted.push(input)
      }),
      rawDataSourceManager: {
        writeRecord: vi.fn(),
        tombstone
      },
      graphNodeLookup: {
        findNodeById: vi.fn(async () => ({
          id: nodeId,
          name: '临时人物',
          nodeType: 'person'
        }))
      }
    })

    const text = await tool.execute(
      {
        summary: '清理测试节点',
        entities: [{ id: nodeId, action: 'delete' }]
      } as never,
      context
    )

    expect(deleted).toEqual([{ kind: 'node', id: nodeId }])
    expect(tombstone).not.toHaveBeenCalled()
    expect(text).toContain('删节点 1')
    expect(text).toContain('文件层与本地索引已一并删除')
  })

  it('falls back to tombstone when deleteGraphRecord is missing during node delete', async () => {
    const tombstones: Array<{ kind: string; id: string; opts?: unknown }> = []
    const nodeId = graphNodeIdForEntity(VAULT, 'person', '临时人物B')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord: vi.fn(),
        tombstone: vi.fn(async (kind: string, id: string, opts?: unknown) => {
          tombstones.push({ kind, id, opts })
        })
      },
      graphNodeLookup: {
        findNodeById: vi.fn(async () => ({
          id: nodeId,
          name: '临时人物B',
          nodeType: 'person',
          shardMonth: '2026-08'
        }))
      }
    })

    const text = await tool.execute(
      {
        summary: '清理测试节点B',
        entities: [{ id: nodeId, action: 'delete' }]
      } as never,
      context
    )

    expect(tombstones).toEqual([
      { kind: 'graph', id: nodeId, opts: { collection: 'nodes', shardMonth: '2026-08' } }
    ])
    expect(text).toContain('删节点 1')
  })
})
