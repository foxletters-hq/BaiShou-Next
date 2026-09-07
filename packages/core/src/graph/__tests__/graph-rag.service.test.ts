import { describe, expect, it, vi } from 'vitest'
import { GRAPH_MAX_NEIGHBORS_PER_HOP } from '@baishou/shared'
import { GraphRagService } from '../graph-rag.service'

function node(partial: { id: string; name: string; nodeType?: string; reviewStatus?: string }) {
  return {
    id: partial.id,
    name: partial.name,
    nodeType: partial.nodeType ?? 'person',
    reviewStatus: partial.reviewStatus ?? 'approved',
    summary: ''
  }
}

describe('GraphRagService extra recall modes', () => {
  it('search returns name matches without walking edges', async () => {
    const repo = {
      searchNodesByName: vi.fn(async () => [node({ id: 'n1', name: '小明' })])
    }
    const rag = new GraphRagService(repo as never)
    const result = await rag.recallRelations({
      vaultId: 'v1',
      entity: '小明',
      mode: 'search',
      nodeType: 'person',
      limit: 5
    })
    expect(repo.searchNodesByName).toHaveBeenCalledWith('v1', '小明', {
      nodeTypes: ['person'],
      limit: 5
    })
    expect(result.nodes.map((n) => n.id)).toEqual(['n1'])
    expect(result.subgraph).toEqual([])
    expect(result.paths).toEqual([])
  })

  it('neighbors traverses from the first anchor', async () => {
    const repo = {
      searchNodesByName: vi.fn(async () => [node({ id: 'n1', name: '小明' })]),
      traverse: vi.fn(async () => ({
        nodes: [
          node({ id: 'n1', name: '小明' }),
          node({ id: 'n2', name: '杭州', nodeType: 'place' })
        ],
        edges: [
          {
            id: 'e1',
            fromId: 'n1',
            toId: 'n2',
            edgeType: 'located_at',
            isCurrent: true
          }
        ]
      }))
    }
    const rag = new GraphRagService(repo as never)
    const result = await rag.recallRelations({
      vaultId: 'v1',
      entity: '小明',
      mode: 'neighbors'
    })
    expect(repo.traverse).toHaveBeenCalledWith(
      'v1',
      'n1',
      1,
      expect.objectContaining({
        approvedOnly: true,
        maxNeighborsPerHop: GRAPH_MAX_NEIGHBORS_PER_HOP
      })
    )
    expect(result.anchors[0]?.id).toBe('n1')
    expect(result.subgraph).toHaveLength(1)
    expect(result.nodes).toHaveLength(2)
  })

  it('filters neighbor edges to the same keep set as limited nodes', async () => {
    const repo = {
      searchNodesByName: vi.fn(async () => [node({ id: 'n1', name: '小明' })]),
      traverse: vi.fn(async () => ({
        nodes: [
          node({ id: 'n1', name: '小明' }),
          node({ id: 'n2', name: '杭州' }),
          node({ id: 'n3', name: '上海' })
        ],
        edges: [
          { id: 'e1', fromId: 'n1', toId: 'n2', edgeType: 'located_at', isCurrent: true },
          { id: 'e2', fromId: 'n1', toId: 'n3', edgeType: 'located_at', isCurrent: true }
        ]
      }))
    }
    const rag = new GraphRagService(repo as never)
    const result = await rag.recallRelations({
      vaultId: 'v1',
      entity: '小明',
      mode: 'neighbors',
      limit: 1
    })
    const keep = new Set(result.nodes.map((n) => n.id))
    expect(keep.has('n1')).toBe(true)
    expect(result.nodes).toHaveLength(2)
    for (const e of result.subgraph) {
      expect(keep.has(e.fromId)).toBe(true)
      expect(keep.has(e.toId)).toBe(true)
    }
  })

  it('network mode uses path APIs and does not call traverse', async () => {
    const repo = {
      searchNodesByName: vi.fn(async () => [node({ id: 'n1', name: '小明' })]),
      traverse: vi.fn(),
      listEntityTimeline: vi.fn(),
      findPathsFrom: vi.fn(async () => []),
      findShortestPath: vi.fn()
    }
    const rag = new GraphRagService(repo as never)
    const result = await rag.recallRelations({
      vaultId: 'v1',
      entity: '小明',
      mode: 'network'
    })
    expect(repo.traverse).not.toHaveBeenCalled()
    expect(repo.listEntityTimeline).not.toHaveBeenCalled()
    expect(repo.findPathsFrom).toHaveBeenCalled()
    expect(result.paths).toEqual([])
  })

  it('timeline mode uses listEntityTimeline and does not call traverse', async () => {
    const repo = {
      searchNodesByName: vi.fn(async () => [node({ id: 'n1', name: '小明' })]),
      traverse: vi.fn(),
      findPathsFrom: vi.fn(),
      findShortestPath: vi.fn(),
      listEntityTimeline: vi.fn(async () => ({
        nodes: [node({ id: 'n1', name: '小明' })],
        edges: [
          {
            id: 'e1',
            fromId: 'n1',
            toId: 'n2',
            isCurrent: true,
            edgeType: 'relates_to'
          }
        ]
      }))
    }
    const rag = new GraphRagService(repo as never)
    const result = await rag.recallRelations({
      vaultId: 'v1',
      entity: '小明',
      mode: 'timeline'
    })
    expect(repo.traverse).not.toHaveBeenCalled()
    expect(repo.findPathsFrom).not.toHaveBeenCalled()
    expect(repo.listEntityTimeline).toHaveBeenCalledWith('v1', 'n1', { approvedOnly: true })
    expect(result.timeline).toHaveLength(1)
  })

  it('does not call embedQuery for a small named neighborhood', async () => {
    const embedQuery = vi.fn(async () => [0.1, 0.2, 0.3, 0.4])
    const repo = {
      searchNodesByName: vi.fn(async () => [node({ id: 'n1', name: '小明' })]),
      traverse: vi.fn(
        async (
          _vaultId: string,
          _centerId: string,
          _depth: number,
          _opts?: { resolveQueryVector?: () => Promise<number[] | null> }
        ) => ({
          nodes: [node({ id: 'n1', name: '小明' }), node({ id: 'n2', name: '杭州' })],
          edges: [{ id: 'e1', fromId: 'n1', toId: 'n2', edgeType: 'located_at', isCurrent: true }]
        })
      )
    }
    const rag = new GraphRagService(repo as never)
    await rag.recallRelations({
      vaultId: 'v1',
      entity: '小明',
      mode: 'neighbors',
      embedQuery
    })
    expect(embedQuery).toHaveBeenCalledTimes(0)
    expect(repo.traverse.mock.calls[0]?.[3]?.resolveQueryVector).toEqual(expect.any(Function))
  })

  it('embeds the query once when traverse asks for a vector on two hops', async () => {
    const embedQuery = vi.fn(async () => [0.1, 0.2, 0.3, 0.4])
    const repo = {
      searchNodesByName: vi.fn(async () => [node({ id: 'n1', name: '小明' })]),
      traverse: vi.fn(
        async (
          _vaultId: string,
          _centerId: string,
          _depth: number,
          opts?: { resolveQueryVector?: () => Promise<number[] | null> }
        ) => {
          await opts?.resolveQueryVector?.()
          await opts?.resolveQueryVector?.()
          return {
            nodes: [node({ id: 'n1', name: '小明' })],
            edges: []
          }
        }
      )
    }
    const rag = new GraphRagService(repo as never)
    await rag.recallRelations({
      vaultId: 'v1',
      entity: '小明',
      mode: 'neighbors',
      depth: 2,
      embedQuery
    })
    expect(embedQuery).toHaveBeenCalledTimes(1)
    expect(embedQuery).toHaveBeenCalledWith('小明')
  })
})
