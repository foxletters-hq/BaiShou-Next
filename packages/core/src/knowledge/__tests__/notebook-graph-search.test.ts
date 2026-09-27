import { describe, expect, it, vi } from 'vitest'
import { searchNotebookGraphForTool } from '../notebook-graph-search'

describe('searchNotebookGraphForTool', () => {
  it('无锚点返回空图', async () => {
    const repo = {
      searchNodes: vi.fn(async () => []),
      getNeighborhood: vi.fn(),
      getView: vi.fn(),
      findShortestPath: vi.fn(),
      findNodeByName: vi.fn(),
      findNodesByNameOrAlias: vi.fn()
    }
    const result = await searchNotebookGraphForTool(repo as never, {
      vaultId: 'v1',
      notebookId: 'nb1',
      query: '甲'
    })
    expect(result).toEqual({ nodes: [], edges: [], paths: [] })
    expect(repo.getView).not.toHaveBeenCalled()
  })

  it('两个锚点时带上最短路', async () => {
    const repo = {
      searchNodes: vi.fn(async () => [
        { id: 'a', name: '甲', nodeType: 'person', summary: '' },
        { id: 'b', name: '乙', nodeType: 'person', summary: '' }
      ]),
      getView: vi.fn(async () => ({
        nodes: [
          { id: 'a', name: '甲', nodeType: 'person', summary: '' },
          { id: 'b', name: '乙', nodeType: 'person', summary: '' }
        ],
        edges: [{ id: 'e1', fromId: 'a', toId: 'b', edgeType: 'relates_to', sourceExcerpt: '认识' }]
      })),
      getNeighborhood: vi.fn(),
      findShortestPath: vi.fn(async () => ({
        nodeIds: ['a', 'b'],
        edges: [{ sourceExcerpt: '认识', sourceRef: 'src1#0' }]
      })),
      findNodeByName: vi.fn(),
      findNodesByNameOrAlias: vi.fn()
    }
    const result = await searchNotebookGraphForTool(repo as never, {
      vaultId: 'v1',
      notebookId: 'nb1',
      query: '甲'
    })
    expect(result.paths).toEqual([{ nodeNames: ['甲', '乙'], excerpts: ['认识'] }])
    expect(repo.getNeighborhood).not.toHaveBeenCalled()
  })

  it('should use vector-matched graph nodes as anchors when embedQuery is provided', async () => {
    const repo = {
      searchNodes: vi.fn(async () => []),
      searchNodesByVector: vi.fn(async () => [
        { id: 'n1', name: '现金流象限', nodeType: 'topic', summary: '四象限', distance: 0.1 }
      ]),
      getNeighborhood: vi.fn(async () => ({
        nodes: [{ id: 'n1', name: '现金流象限', nodeType: 'topic', summary: '四象限' }],
        edges: []
      })),
      getView: vi.fn(),
      findShortestPath: vi.fn()
    }
    const embedQuery = vi.fn(async () => [1, 0, 0, 0])
    const result = await searchNotebookGraphForTool(repo as never, {
      vaultId: 'v1',
      notebookId: 'nb1',
      query: '现金流象限 资产 财务自由',
      embedQuery,
      modelId: 'emb-1',
      limit: 1
    })
    expect(embedQuery).toHaveBeenCalledWith('现金流象限 资产 财务自由')
    expect(repo.searchNodesByVector).toHaveBeenCalledWith('v1', 'nb1', [1, 0, 0, 0], 1, {
      modelId: 'emb-1'
    })
    expect(repo.searchNodes).not.toHaveBeenCalled()
    expect(result.nodes[0]?.name).toBe('现金流象限')
    expect(repo.getNeighborhood).toHaveBeenCalled()
  })

  it('should fall back to name search when vector search returns no nodes', async () => {
    const repo = {
      searchNodes: vi.fn(async () => [
        { id: 'n1', name: '财务自由', nodeType: 'topic', summary: '' }
      ]),
      searchNodesByVector: vi.fn(async () => []),
      getNeighborhood: vi.fn(async () => ({
        nodes: [{ id: 'n1', name: '财务自由', nodeType: 'topic', summary: '' }],
        edges: []
      })),
      getView: vi.fn(),
      findShortestPath: vi.fn()
    }
    const result = await searchNotebookGraphForTool(repo as never, {
      vaultId: 'v1',
      notebookId: 'nb1',
      query: '财务自由',
      embedQuery: async () => [0, 1, 0, 0],
      modelId: 'emb-1'
    })
    expect(repo.searchNodesByVector).toHaveBeenCalled()
    expect(repo.searchNodes).toHaveBeenCalledWith(
      expect.objectContaining({ query: '财务自由', notebookId: 'nb1' })
    )
    expect(result.nodes[0]?.name).toBe('财务自由')
  })

  it('should name-search whitespace-separated terms when the full query misses', async () => {
    const repo = {
      searchNodes: vi.fn(async (opts: { query: string }) => {
        if (opts.query === '现金流象限 资产') return []
        if (opts.query === '现金流象限') {
          return [{ id: 'n1', name: '现金流象限', nodeType: 'topic', summary: '' }]
        }
        if (opts.query === '资产') {
          return [{ id: 'n2', name: '资产', nodeType: 'topic', summary: '' }]
        }
        return []
      }),
      getView: vi.fn(async () => ({ nodes: [], edges: [] })),
      getNeighborhood: vi.fn(),
      findShortestPath: vi.fn(async () => null)
    }
    const result = await searchNotebookGraphForTool(repo as never, {
      vaultId: 'v1',
      notebookId: 'nb1',
      query: '现金流象限 资产'
    })
    expect(repo.searchNodes).toHaveBeenCalledWith(expect.objectContaining({ query: '现金流象限' }))
    expect(repo.searchNodes).toHaveBeenCalledWith(expect.objectContaining({ query: '资产' }))
    expect(result.nodes.map((n) => n.name)).toEqual(['现金流象限', '资产'])
  })

  it('should keep vector-matched anchors when the graph view omits them', async () => {
    const repo = {
      searchNodes: vi.fn(async () => []),
      searchNodesByVector: vi.fn(async () => [
        { id: 'n1', name: '真实自体', nodeType: 'topic', summary: '', distance: 0.2 },
        { id: 'n2', name: '全能自恋', nodeType: 'topic', summary: '', distance: 0.3 }
      ]),
      getView: vi.fn(async () => ({
        nodes: [{ id: 'hot', name: '热门节点', nodeType: 'topic', summary: '' }],
        edges: []
      })),
      getNeighborhood: vi.fn(),
      findShortestPath: vi.fn(async () => null)
    }
    const result = await searchNotebookGraphForTool(repo as never, {
      vaultId: 'v1',
      notebookId: 'nb1',
      query: '真实自体 全能自恋',
      embedQuery: async () => [0, 0, 1, 0],
      limit: 2
    })
    expect(result.nodes.map((n) => n.name)).toEqual(['真实自体', '全能自恋', '热门节点'])
  })
})
