import { describe, expect, it, vi } from 'vitest'
import { createCompanionGraphLookups } from '../graph.adapter'

describe('createCompanionGraphLookups', () => {
  it('wires findNodeById and findEdgeById so graph_upsert can update edges', async () => {
    const getNodeById = vi.fn(async (id: string) =>
      id === 'n1' ? { id: 'n1', name: '小明', nodeType: 'person' } : null
    )
    const getEdgeById = vi.fn(async (id: string) =>
      id === 'e1'
        ? { id: 'e1', fromId: 'n1', toId: 'n2', edgeType: 'knows', shardMonth: '2026-07' }
        : null
    )
    const { graphNodeLookup, graphEdgeLookup } = createCompanionGraphLookups(async () => ({
      findByNameOrAlias: async () => null,
      getNodeById,
      getEdgeById
    }))

    await expect(graphNodeLookup.findNodeById?.('n1')).resolves.toMatchObject({
      id: 'n1',
      name: '小明'
    })
    await expect(graphEdgeLookup.findEdgeById('e1')).resolves.toMatchObject({
      id: 'e1',
      edgeType: 'knows'
    })
    expect(getNodeById).toHaveBeenCalledWith('n1')
    expect(getEdgeById).toHaveBeenCalledWith('e1')
  })

  it('resolves exact name hits through findByNameOrAlias', async () => {
    const findByNameOrAlias = vi.fn(async (name: string, nodeType?: string) =>
      name === '杭州' && nodeType === 'place'
        ? { id: 'p1', name: '杭州', nodeType: 'place' }
        : null
    )
    const { graphNodeLookup } = createCompanionGraphLookups(async () => ({
      findByNameOrAlias,
      getNodeById: async () => null,
      getEdgeById: async () => null
    }))

    await expect(
      graphNodeLookup.findNodeByName({ name: '杭州', nodeType: 'place' })
    ).resolves.toMatchObject({ id: 'p1', name: '杭州' })
  })
})
