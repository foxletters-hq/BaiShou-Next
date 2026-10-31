export const GRAPH_INVENTORY_PAGE_SIZES = [10, 20, 50] as const
export const GRAPH_INVENTORY_PAGE_SIZE_DEFAULT = 20

export type GraphInventoryNode = {
  id: string
  name: string
  nodeType?: string
  summary?: string
  discriminator?: string
  mentionCount?: number
  reviewStatus?: string
}

export function toGraphInventoryNode(row: {
  id: string
  name?: string
  nodeType?: string
  summary?: string
  discriminator?: string
  mentionCount?: number
  reviewStatus?: string
}): GraphInventoryNode {
  return {
    id: row.id,
    name: row.name || row.id,
    nodeType: row.nodeType,
    summary: row.summary,
    discriminator: row.discriminator,
    mentionCount: row.mentionCount,
    reviewStatus: row.reviewStatus
  }
}

export function graphInventoryHasItems(nodeCount: number): boolean {
  return nodeCount > 0
}

export function graphInventoryReviewCount(input: {
  pendingCount: number
  similarCount: number
  reextractCount: number
}): number {
  return input.pendingCount + input.similarCount + input.reextractCount
}

export function graphInventoryUsesSearchHits(
  searchMode: 'text' | 'semantic',
  query: string
): boolean {
  return searchMode === 'semantic' && query.trim().length > 0
}

export function graphInventoryBrowsableNodes<T extends { reviewStatus?: string }>(nodes: T[]): T[] {
  return nodes.filter((node) => node.reviewStatus !== 'rejected')
}

export function graphInventoryKeywordHaystack(node: {
  name: string
  nodeType?: string
  summary?: string
  discriminator?: string
}): string {
  return `${node.name} ${node.nodeType ?? ''} ${node.summary ?? ''} ${node.discriminator ?? ''}`
}

export function filterGraphInventoryNodes<
  T extends { name: string; nodeType?: string; summary?: string; discriminator?: string }
>(nodes: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  return nodes.filter((node) => graphInventoryKeywordHaystack(node).toLowerCase().includes(q))
}

export function graphInventoryTotalPages(total: number, pageSize: number): number {
  const size = Math.max(1, pageSize)
  return Math.max(1, Math.ceil(total / size) || 1)
}

export function graphInventorySafePage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), Math.max(1, totalPages))
}

export function graphInventoryPageOffset(page: number, pageSize: number): number {
  const size = Math.max(1, pageSize)
  return (graphInventorySafePage(page, Number.MAX_SAFE_INTEGER) - 1) * size
}

export function paginateGraphInventoryNodes<T>(
  items: T[],
  page: number,
  pageSize: number
): { items: T[]; total: number; page: number; totalPages: number } {
  const total = items.length
  const totalPages = graphInventoryTotalPages(total, pageSize)
  const safePage = graphInventorySafePage(page, totalPages)
  const start = graphInventoryPageOffset(safePage, pageSize)
  return {
    items: items.slice(start, start + Math.max(1, pageSize)),
    total,
    page: safePage,
    totalPages
  }
}

export function sortGraphInventoryNodesByActionable(
  items: GraphInventoryNode[]
): GraphInventoryNode[] {
  return [...items].sort((a, b) => {
    const aActionable = a.reviewStatus === 'pending' ? 1 : 0
    const bActionable = b.reviewStatus === 'pending' ? 1 : 0
    return bActionable - aActionable
  })
}

export function resolveGraphInventoryList(input: {
  pageItems: GraphInventoryNode[]
  total: number
  searchHits: GraphInventoryNode[]
  searchMode: 'text' | 'semantic'
  query: string
  page: number
  pageSize: number
}): {
  items: GraphInventoryNode[]
  total: number
  page: number
  totalPages: number
  showPagination: boolean
} {
  if (graphInventoryUsesSearchHits(input.searchMode, input.query)) {
    return {
      items: sortGraphInventoryNodesByActionable(input.searchHits),
      total: input.searchHits.length,
      page: 1,
      totalPages: 1,
      showPagination: false
    }
  }
  const totalPages = graphInventoryTotalPages(input.total, input.pageSize)
  const page = graphInventorySafePage(input.page, totalPages)
  return {
    items: sortGraphInventoryNodesByActionable(input.pageItems),
    total: input.total,
    page,
    totalPages,
    showPagination: input.total > 0
  }
}

export type GraphInventorySnapshot = {
  pageItems: GraphInventoryNode[]
  searchHits?: GraphInventoryNode[]
  total: number
  nodeCount: number
  edgeCount: number
  page: number
}

export function applyGraphInventoryNodeDelete(input: {
  nodeId: string
  deletedEdgeCount?: number
  pageItems: GraphInventoryNode[]
  searchHits?: GraphInventoryNode[]
  total: number
  nodeCount: number
  edgeCount: number
  page: number
}): {
  pageItems: GraphInventoryNode[]
  searchHits: GraphInventoryNode[]
  total: number
  nodeCount: number
  edgeCount: number
  page: number
} {
  const hadInPage = input.pageItems.some((item) => item.id === input.nodeId)
  const pageItems = input.pageItems.filter((item) => item.id !== input.nodeId)
  const searchHits = (input.searchHits ?? []).filter((item) => item.id !== input.nodeId)
  const total = hadInPage ? Math.max(0, input.total - 1) : input.total
  const nodeCount = Math.max(0, input.nodeCount - 1)
  const edgeCount = Math.max(0, input.edgeCount - Math.max(0, input.deletedEdgeCount ?? 0))
  const page = pageItems.length === 0 && input.page > 1 && total > 0 ? input.page - 1 : input.page
  return {
    pageItems,
    searchHits,
    total,
    nodeCount,
    edgeCount,
    page
  }
}

export function applyGraphInventoryEdgeDelete(
  edgeCount: number,
  deletedEdgeCount = 1
): number {
  return Math.max(0, edgeCount - Math.max(0, deletedEdgeCount))
}

