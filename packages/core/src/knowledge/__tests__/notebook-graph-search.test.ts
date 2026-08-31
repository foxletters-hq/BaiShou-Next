import { describe, expect, it, vi } from 'vitest'
import { searchNotebookGraphForTool } from '../notebook-graph-search'

describe('searchNotebookGraphForTool', () => {
  it('无锚点返回空图', async () => {
    const repo = {
      searchNodes: vi.fn(async () => []),
      getNeighborhood: vi.fn(),
      getView: vi.fn(),
      findShortestPath: vi.fn()
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
      findNodeByName: vi.fn()
    }
    const result = await searchNotebookGraphForTool(repo as never, {
      vaultId: 'v1',
      notebookId: 'nb1',
      query: '甲'
    })
    expect(result.paths).toEqual([{ nodeNames: ['甲', '乙'], excerpts: ['认识'] }])
    expect(repo.getNeighborhood).not.toHaveBeenCalled()
  })
})
