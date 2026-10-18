import { describe, expect, it } from 'vitest'
import {
  filterGraphInventoryNodes,
  graphInventoryHasItems,
  graphInventoryPageOffset,
  graphInventoryReviewCount,
  graphInventoryUsesSearchHits,
  paginateGraphInventoryNodes,
  resolveGraphInventoryList
} from '../graph-node-inventory.util'

describe('graphInventoryHasItems', () => {
  it('should show inventory when live nodes already exist', () => {
    expect(graphInventoryHasItems(0)).toBe(false)
    expect(graphInventoryHasItems(3)).toBe(true)
  })
})

describe('graphInventoryReviewCount', () => {
  it('should sum pending, similar and reextract queues', () => {
    expect(graphInventoryReviewCount({ pendingCount: 2, similarCount: 1, reextractCount: 4 })).toBe(
      7
    )
    expect(graphInventoryReviewCount({ pendingCount: 0, similarCount: 0, reextractCount: 0 })).toBe(
      0
    )
  })
})

describe('graphInventoryUsesSearchHits', () => {
  it('should use semantic hits only when the query is not empty', () => {
    expect(graphInventoryUsesSearchHits('semantic', '')).toBe(false)
    expect(graphInventoryUsesSearchHits('semantic', '张三')).toBe(true)
    expect(graphInventoryUsesSearchHits('text', '张三')).toBe(false)
  })
})

describe('filterGraphInventoryNodes', () => {
  it('should match name, type, summary and discriminator annotations', () => {
    const nodes = [
      { id: '1', name: '张三', nodeType: 'person', summary: '同学', discriminator: '' },
      { id: '2', name: '张三', nodeType: 'person', summary: '', discriminator: '同事' },
      { id: '3', name: '上海', nodeType: 'place', summary: '住过', discriminator: '' }
    ]
    expect(filterGraphInventoryNodes(nodes, '同事').map((row) => row.id)).toEqual(['2'])
    expect(filterGraphInventoryNodes(nodes, 'place').map((row) => row.id)).toEqual(['3'])
    expect(filterGraphInventoryNodes(nodes, '同学').map((row) => row.id)).toEqual(['1'])
  })
})

describe('paginateGraphInventoryNodes', () => {
  it('should return the requested page and clamp an overflowing page', () => {
    const rows = ['a', 'b', 'c', 'd', 'e']
    expect(paginateGraphInventoryNodes(rows, 2, 2)).toEqual({
      items: ['c', 'd'],
      total: 5,
      page: 2,
      totalPages: 3
    })
    expect(paginateGraphInventoryNodes(rows, 9, 2).page).toBe(3)
    expect(graphInventoryPageOffset(2, 20)).toBe(20)
  })
})

describe('resolveGraphInventoryList', () => {
  it('should keep server pages for empty or text queries and skip month-window clipping', () => {
    const listed = resolveGraphInventoryList({
      pageItems: [{ id: 'old', name: '两年前的人' }],
      total: 41,
      searchHits: [{ id: 'hit', name: '噪声' }],
      searchMode: 'text',
      query: '',
      page: 3,
      pageSize: 20
    })
    expect(listed.items.map((row) => row.id)).toEqual(['old'])
    expect(listed.total).toBe(41)
    expect(listed.page).toBe(3)
    expect(listed.totalPages).toBe(3)
    expect(listed.showPagination).toBe(true)
  })

  it('should replace the page with semantic hits and hide pagination', () => {
    const listed = resolveGraphInventoryList({
      pageItems: [{ id: 'page', name: '分页项' }],
      total: 40,
      searchHits: [{ id: 'hit', name: '语义命中' }],
      searchMode: 'semantic',
      query: '同事',
      page: 2,
      pageSize: 20
    })
    expect(listed.items.map((row) => row.id)).toEqual(['hit'])
    expect(listed.page).toBe(1)
    expect(listed.showPagination).toBe(false)
  })

  it('should prioritize actionable pending nodes to the top', () => {
    const listed = resolveGraphInventoryList({
      pageItems: [
        { id: 'approved-1', name: '已通过节点', reviewStatus: 'approved' },
        { id: 'pending-1', name: '待确认节点', reviewStatus: 'pending' },
        { id: 'approved-2', name: '已通过节点2', reviewStatus: 'approved' }
      ],
      total: 3,
      searchHits: [],
      searchMode: 'text',
      query: '',
      page: 1,
      pageSize: 20
    })
    expect(listed.items.map((row) => row.id)).toEqual(['pending-1', 'approved-1', 'approved-2'])
  })
})
