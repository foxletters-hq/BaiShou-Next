export function notebookGraphHasInventory(nodeCount: number): boolean {
  return nodeCount > 0
}

export function shouldResetNotebookGraphSearch(query: string): boolean {
  return query.trim().length === 0
}

export function isCurrentNotebookGraphSearch(startedSeq: number, latestSeq: number): boolean {
  return startedSeq === latestSeq
}

export type NotebookGraphListNode = {
  id: string
  name: string
  nodeType?: string
  summary?: string
  mentionCount?: number
  reviewStatus?: string
}

export function notebookGraphUsesSearchHits(
  searchMode: 'text' | 'semantic',
  query: string
): boolean {
  return searchMode === 'semantic' && query.trim().length > 0
}

export function notebookGraphBrowsableNodes<T extends { reviewStatus?: string }>(nodes: T[]): T[] {
  return nodes.filter((node) => node.reviewStatus !== 'rejected')
}

export function filterNotebookGraphNodes<
  T extends { name: string; nodeType?: string; summary?: string }
>(nodes: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  return nodes.filter((node) => {
    const hay = `${node.name} ${node.nodeType ?? ''} ${node.summary ?? ''}`.toLowerCase()
    return hay.includes(q)
  })
}

export function paginateNotebookGraphNodes<T>(
  items: T[],
  page: number,
  pageSize: number
): { items: T[]; total: number; page: number; totalPages: number } {
  const total = items.length
  const size = Math.max(1, pageSize)
  const totalPages = Math.max(1, Math.ceil(total / size) || 1)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * size
  return {
    items: items.slice(start, start + size),
    total,
    page: safePage,
    totalPages
  }
}

export function resolveNotebookGraphList(input: {
  nodes: NotebookGraphListNode[]
  searchHits: NotebookGraphListNode[]
  searchMode: 'text' | 'semantic'
  query: string
  page: number
  pageSize: number
  totalOverride?: number
  isServerPaged?: boolean
}): {
  items: NotebookGraphListNode[]
  total: number
  page: number
  totalPages: number
  showPagination: boolean
} {
  if (notebookGraphUsesSearchHits(input.searchMode, input.query)) {
    return {
      items: input.searchHits,
      total: input.searchHits.length,
      page: 1,
      totalPages: 1,
      showPagination: false
    }
  }
  if (input.isServerPaged) {
    const total = input.totalOverride ?? input.nodes.length
    const size = Math.max(1, input.pageSize)
    const totalPages = Math.max(1, Math.ceil(total / size) || 1)
    const safePage = Math.min(Math.max(1, input.page), totalPages)
    return {
      items: input.nodes,
      total,
      page: safePage,
      totalPages,
      showPagination: total > 0
    }
  }
  const filtered = filterNotebookGraphNodes(notebookGraphBrowsableNodes(input.nodes), input.query)
  const paged = paginateNotebookGraphNodes(filtered, input.page, input.pageSize)
  return { ...paged, showPagination: paged.total > 0 }
}

export function knowledgeNotebookGraphNodeHref(
  notebookId: string,
  nodeId: string
): { pathname: '/knowledge-node'; params: { notebookId: string; nodeId: string } } {
  return {
    pathname: '/knowledge-node',
    params: { notebookId, nodeId }
  }
}

export function knowledgeNotebookGraphReviewHref(notebookId: string): {
  pathname: '/knowledge-review'
  params: { notebookId: string }
} {
  return {
    pathname: '/knowledge-review',
    params: { notebookId }
  }
}

export function notebookGraphPartnerId(
  edge: { fromId: string; toId: string },
  nodeId: string
): string {
  return edge.fromId === nodeId ? edge.toId : edge.fromId
}

export function notebookGraphCurrentEdges<T extends { isCurrent?: number | boolean }>(
  edges: T[]
): T[] {
  return edges.filter((edge) => edge.isCurrent !== 0 && edge.isCurrent !== false)
}

export function filterNotebookGraphMergeHits<T extends { id: string; nodeType?: string }>(
  hits: T[],
  opts: { currentId: string; nodeType?: string }
): T[] {
  const seen = new Set<string>()
  const next: T[] = []
  for (const hit of hits) {
    if (hit.id === opts.currentId) continue
    if (opts.nodeType && hit.nodeType !== opts.nodeType) continue
    if (seen.has(hit.id)) continue
    seen.add(hit.id)
    next.push(hit)
  }
  return next
}

export function notebookGraphReviewCount(input: {
  pendingNodeCount: number
  pendingEdgeCount: number
  similarPairCount: number
}): number {
  return input.pendingNodeCount + input.pendingEdgeCount + input.similarPairCount
}

export function notebookGraphFragmentBody(item: {
  excerpts: string[]
  text: string | null
}): string {
  const excerpt = item.excerpts
    .map((row) => row.trim())
    .filter(Boolean)
    .join('\n\n')
  if (excerpt) return excerpt
  return item.text?.trim() || ''
}
