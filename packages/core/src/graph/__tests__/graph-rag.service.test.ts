import { describe, expect, it, vi } from 'vitest'
import { GraphRagService } from '../graph-rag.service'

function node(partial: {
  id: string
  name: string
  nodeType?: string
  reviewStatus?: string
}) {
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
        nodes: [node({ id: 'n1', name: '小明' }), node({ id: 'n2', name: '杭州', nodeType: 'place' })],
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
    expect(repo.traverse).toHaveBeenCalledWith('v1', 'n1', 1, { approvedOnly: true })
    expect(result.anchors[0]?.id).toBe('n1')
    expect(result.subgraph).toHaveLength(1)
    expect(result.nodes).toHaveLength(2)
  })
})
