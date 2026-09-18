import { GRAPH_NODE_TYPE_LABEL_FALLBACKS } from '@baishou/shared'
import type { GraphLocalView, GraphPageEdge, GraphPageNode } from './graph-page.types'

/** Entity types available in the filter panel (exclude structural diary anchors). */
export const GRAPH_FILTER_NODE_TYPES = Object.keys(GRAPH_NODE_TYPE_LABEL_FALLBACKS).filter(
  (t) => t !== 'entry'
)

export function isGraphTypeFilterActive(enabledNodeTypes: Set<string>): boolean {
  return enabledNodeTypes.size !== GRAPH_FILTER_NODE_TYPES.length
}

export function isGraphCanvasFilterActive(opts: {
  hideEntry: boolean
  approvedOnly: boolean
  enabledNodeTypes: Set<string>
}): boolean {
  return !opts.hideEntry || opts.approvedOnly || isGraphTypeFilterActive(opts.enabledNodeTypes)
}

export function toggleGraphNodeTypeFilter(prev: Set<string>, nodeType: string): Set<string> {
  const next = new Set(prev)
  if (next.has(nodeType)) next.delete(nodeType)
  else next.add(nodeType)
  return next
}

export function filterGraphPageDisplayNode(
  n: GraphPageNode,
  opts: {
    hideEntry: boolean
    approvedOnly: boolean
    enabledNodeTypes: Set<string>
    selectedId: string | null
    highlightIds: Set<string>
    highlightedEdgeIds: Set<string>
    keepPendingSelected?: boolean
  }
): boolean {
  if (n.reviewStatus === 'rejected') return false
  const keepLocated = opts.highlightedEdgeIds.size > 0 && opts.highlightIds.has(n.id)
  if (opts.hideEntry && n.nodeType === 'entry' && !keepLocated) return false
  if (n.nodeType !== 'entry' && !keepLocated) {
    const nt = String(n.nodeType || '')
    if (GRAPH_FILTER_NODE_TYPES.includes(nt) && !opts.enabledNodeTypes.has(nt)) return false
  }
  if (
    opts.approvedOnly &&
    n.reviewStatus === 'pending' &&
    !(opts.keepPendingSelected && n.id === opts.selectedId) &&
    !keepLocated
  ) {
    return false
  }
  return true
}

export function buildGraphPageDisplayNodes(opts: {
  nodes: GraphPageNode[]
  hideEntry: boolean
  approvedOnly: boolean
  enabledNodeTypes: Set<string>
  localView: GraphLocalView | null
  selectedId: string | null
  selectedNode: GraphPageNode | null
  pinNeighborhood: boolean
  highlightIds: Set<string>
  highlightedEdgeIds: Set<string>
}): GraphPageNode[] {
  const filterOpts = {
    hideEntry: opts.hideEntry,
    approvedOnly: opts.approvedOnly,
    enabledNodeTypes: opts.enabledNodeTypes,
    selectedId: opts.selectedId,
    highlightIds: opts.highlightIds,
    highlightedEdgeIds: opts.highlightedEdgeIds
  }
  const filterNode = (n: GraphPageNode, keepPendingSelected = false) =>
    filterGraphPageDisplayNode(n, { ...filterOpts, keepPendingSelected })

  if (opts.pinNeighborhood && opts.localView?.nodes?.length) {
    return opts.localView.nodes.filter((n) => filterNode(n, true))
  }
  const base = opts.nodes.filter((n) => filterNode(n, true))
  if (!opts.selectedId || base.some((n) => n.id === opts.selectedId)) {
    return base
  }
  const byId = new Map(base.map((n) => [n.id, n]))
  const extras = [
    ...(opts.localView?.nodes || []),
    ...(opts.selectedNode && opts.selectedNode.id === opts.selectedId ? [opts.selectedNode] : [])
  ]
  for (const n of extras) {
    if (!n?.id || byId.has(n.id)) continue
    if (!filterNode(n, true)) continue
    byId.set(n.id, n)
  }
  return [...byId.values()]
}

export function buildGraphPageDisplayEdges(opts: {
  displayNodes: GraphPageNode[]
  edges: GraphPageEdge[]
  approvedOnly: boolean
  localView: GraphLocalView | null
  selectedId: string | null
  nodes: GraphPageNode[]
  pinNeighborhood: boolean
}): GraphPageEdge[] {
  const idSet = new Set(opts.displayNodes.map((n) => n.id))
  const seen = new Set<string>()
  const source = opts.pinNeighborhood
    ? opts.localView?.edges || []
    : opts.selectedId && !opts.nodes.some((n) => n.id === opts.selectedId)
      ? [...opts.edges, ...(opts.localView?.edges || [])]
      : opts.edges
  return source.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    if (e.reviewStatus === 'rejected') return false
    if (!opts.pinNeighborhood && opts.approvedOnly && e.reviewStatus === 'pending') return false
    return idSet.has(e.fromId) && idSet.has(e.toId)
  })
}

export function buildGraphPageDetailEdges<T extends GraphPageEdge>(opts: {
  selectedId: string | null
  localView: { edges?: T[] } | null
  edges: T[]
  resolvePartnerName: (partnerId: string) => string
}): Array<{ edge: T; partnerName: string }> {
  if (!opts.selectedId) return []
  const seen = new Set<string>()
  const list: Array<{ edge: T; partnerName: string }> = []
  const edgeSource = opts.localView?.edges?.length ? opts.localView.edges : opts.edges
  for (const e of edgeSource) {
    if (e.fromId !== opts.selectedId && e.toId !== opts.selectedId) continue
    if (seen.has(e.id)) continue
    seen.add(e.id)
    if (e.reviewStatus === 'rejected') continue
    const partnerId = e.fromId === opts.selectedId ? e.toId : e.fromId
    list.push({
      edge: e,
      partnerName: opts.resolvePartnerName(partnerId)
    })
  }
  return list
}

export function countGraphCanvasNodes(nodes: Array<{ reviewStatus?: string }>): number {
  return nodes.filter((n) => n.reviewStatus !== 'rejected').length
}
