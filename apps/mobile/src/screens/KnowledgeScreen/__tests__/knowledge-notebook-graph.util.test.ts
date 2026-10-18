import { describe, expect, it } from 'vitest'
import {
  filterNotebookGraphMergeHits,
  isCurrentNotebookGraphSearch,
  knowledgeNotebookGraphNodeHref,
  knowledgeNotebookGraphReviewHref,
  notebookGraphCurrentEdges,
  notebookGraphFragmentBody,
  notebookGraphHasInventory,
  notebookGraphPartnerId,
  notebookGraphReviewCount,
  paginateNotebookGraphNodes,
  resolveNotebookGraphList,
  shouldResetNotebookGraphSearch
} from '../knowledge-notebook-graph.util'

describe('notebookGraphHasInventory', () => {
  it('should show inventory when the notebook already has graph nodes', () => {
    expect(notebookGraphHasInventory(0)).toBe(false)
    expect(notebookGraphHasInventory(3)).toBe(true)
  })
})

describe('shouldResetNotebookGraphSearch', () => {
  it('should reset search selection when query is empty or whitespace', () => {
    expect(shouldResetNotebookGraphSearch('')).toBe(true)
    expect(shouldResetNotebookGraphSearch('  ')).toBe(true)
    expect(shouldResetNotebookGraphSearch('张三')).toBe(false)
  })
})

describe('isCurrentNotebookGraphSearch', () => {
  it('should ignore stale search results after a newer query starts', () => {
    expect(isCurrentNotebookGraphSearch(1, 2)).toBe(false)
    expect(isCurrentNotebookGraphSearch(2, 2)).toBe(true)
  })
})

describe('paginateNotebookGraphNodes', () => {
  it('should return the requested page and clamp an overflowing page', () => {
    const rows = ['a', 'b', 'c', 'd', 'e']
    expect(paginateNotebookGraphNodes(rows, 2, 2)).toEqual({
      items: ['c', 'd'],
      total: 5,
      page: 2,
      totalPages: 3
    })
    expect(paginateNotebookGraphNodes(rows, 9, 2).page).toBe(3)
  })
})

describe('resolveNotebookGraphList', () => {
  const nodes = [
    { id: '1', name: '张三', nodeType: 'person', summary: '同学', reviewStatus: 'approved' },
    { id: '2', name: '李四', nodeType: 'person', summary: '同事', reviewStatus: 'pending' },
    { id: '3', name: '旧名', nodeType: 'person', reviewStatus: 'rejected' },
    { id: '4', name: '上海', nodeType: 'place', summary: '住过', reviewStatus: 'approved' }
  ]

  it('should paginate browsable nodes and hide rejected rows when query is empty', () => {
    const listed = resolveNotebookGraphList({
      nodes,
      searchHits: [],
      searchMode: 'semantic',
      query: '',
      page: 1,
      pageSize: 2
    })
    expect(listed.items.map((row) => row.id)).toEqual(['1', '2'])
    expect(listed.total).toBe(3)
    expect(listed.showPagination).toBe(true)
  })

  it('should filter loaded nodes by text query instead of using semantic hits', () => {
    const listed = resolveNotebookGraphList({
      nodes,
      searchHits: [{ id: 'hit', name: '噪声' }],
      searchMode: 'text',
      query: '上海',
      page: 1,
      pageSize: 20
    })
    expect(listed.items.map((row) => row.id)).toEqual(['4'])
    expect(listed.total).toBe(1)
  })

  it('should use semantic search hits without pagination when the query is not empty', () => {
    const listed = resolveNotebookGraphList({
      nodes,
      searchHits: [{ id: 'hit', name: '语义命中', nodeType: 'person' }],
      searchMode: 'semantic',
      query: '同学',
      page: 3,
      pageSize: 20
    })
    expect(listed.items.map((row) => row.id)).toEqual(['hit'])
    expect(listed.showPagination).toBe(false)
    expect(listed.page).toBe(1)
  })

  it('should use server paged rows directly and calculate totalPages from totalOverride', () => {
    const serverRows = [
      { id: '10', name: '服务器节点1', nodeType: 'topic' },
      { id: '11', name: '服务器节点2', nodeType: 'topic' }
    ]
    const listed = resolveNotebookGraphList({
      nodes: serverRows,
      searchHits: [],
      searchMode: 'text',
      query: '',
      page: 2,
      pageSize: 2,
      totalOverride: 15,
      isServerPaged: true
    })
    expect(listed.items).toEqual(serverRows)
    expect(listed.total).toBe(15)
    expect(listed.totalPages).toBe(8)
    expect(listed.page).toBe(2)
    expect(listed.showPagination).toBe(true)
  })
})

describe('knowledgeNotebookGraphNodeHref', () => {
  it('should open a stacked node page with notebook and node ids', () => {
    expect(knowledgeNotebookGraphNodeHref('nb-1', 'node-9')).toEqual({
      pathname: '/knowledge-node',
      params: { notebookId: 'nb-1', nodeId: 'node-9' }
    })
  })
})

describe('knowledgeNotebookGraphReviewHref', () => {
  it('should open a stacked review page with the notebook id', () => {
    expect(knowledgeNotebookGraphReviewHref('nb-1')).toEqual({
      pathname: '/knowledge-review',
      params: { notebookId: 'nb-1' }
    })
  })
})

describe('notebookGraphPartnerId', () => {
  it('should return the other endpoint of a relation', () => {
    expect(notebookGraphPartnerId({ fromId: 'a', toId: 'b' }, 'a')).toBe('b')
    expect(notebookGraphPartnerId({ fromId: 'a', toId: 'b' }, 'b')).toBe('a')
  })
})

describe('notebookGraphCurrentEdges', () => {
  it('should keep current relations and drop retired ones', () => {
    expect(
      notebookGraphCurrentEdges([
        { id: 'live', isCurrent: 1 },
        { id: 'old', isCurrent: 0 }
      ]).map((edge) => edge.id)
    ).toEqual(['live'])
  })
})

describe('filterNotebookGraphMergeHits', () => {
  it('should drop the current node and keep same-type semantic hits', () => {
    expect(
      filterNotebookGraphMergeHits(
        [
          { id: 'self', name: '张三', nodeType: 'person' },
          { id: 'a', name: '小张', nodeType: 'person' },
          { id: 'a', name: '小张', nodeType: 'person' },
          { id: 'b', name: '上海', nodeType: 'place' }
        ],
        { currentId: 'self', nodeType: 'person' }
      ).map((hit) => hit.id)
    ).toEqual(['a'])
  })
})

describe('notebookGraphReviewCount', () => {
  it('should sum pending nodes, edges, and similar pairs', () => {
    expect(
      notebookGraphReviewCount({
        pendingNodeCount: 2,
        pendingEdgeCount: 1,
        similarPairCount: 3
      })
    ).toBe(6)
    expect(
      notebookGraphReviewCount({
        pendingNodeCount: 0,
        pendingEdgeCount: 0,
        similarPairCount: 0
      })
    ).toBe(0)
  })
})

describe('notebookGraphFragmentBody', () => {
  it('should prefer mention excerpts and fall back to the window text', () => {
    expect(notebookGraphFragmentBody({ excerpts: ['  甲  ', '乙'], text: '整窗' })).toBe('甲\n\n乙')
    expect(notebookGraphFragmentBody({ excerpts: ['  '], text: ' 整窗 ' })).toBe('整窗')
  })
})
