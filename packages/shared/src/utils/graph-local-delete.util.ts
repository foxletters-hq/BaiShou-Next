import { graphPendingItemKey } from './graph-review-batch.util'

export type GraphLocalNodeRef = { id: string }
export type GraphLocalEdgeRef = { id: string; fromId?: string; toId?: string }

export type GraphLocalViewSlice<
  TNode extends GraphLocalNodeRef = GraphLocalNodeRef,
  TEdge extends GraphLocalEdgeRef = GraphLocalEdgeRef
> = {
  nodes: TNode[]
  edges: TEdge[]
}

function edgeTouchesNode(edge: GraphLocalEdgeRef, nodeId: string): boolean {
  return edge.fromId === nodeId || edge.toId === nodeId
}

function omitIdFromSet(ids: ReadonlySet<string>, id: string): Set<string> {
  if (!ids.has(id)) return new Set(ids)
  const next = new Set(ids)
  next.delete(id)
  return next
}

function omitIdsFromSet(ids: ReadonlySet<string>, removed: ReadonlySet<string>): Set<string> {
  if (removed.size === 0) return new Set(ids)
  const next = new Set<string>()
  for (const id of ids) {
    if (!removed.has(id)) next.add(id)
  }
  return next
}

function omitPendingKeys(selected: ReadonlySet<string>, keys: readonly string[]): Set<string> {
  if (keys.length === 0) return new Set(selected)
  const drop = new Set(keys)
  const next = new Set<string>()
  for (const key of selected) {
    if (!drop.has(key)) next.add(key)
  }
  return next
}

/** Drop a node and its incident edges from the current graph page lists. Does not read the store. */
export function applyGraphLocalNodeDelete<
  TNode extends GraphLocalNodeRef,
  TEdge extends GraphLocalEdgeRef
>(input: {
  nodeId: string
  nodes: TNode[]
  edges: TEdge[]
  pendingNodes: TNode[]
  pendingEdges: TEdge[]
  pendingSelected: ReadonlySet<string>
  highlightIds: ReadonlySet<string>
  highlightedEdgeIds: ReadonlySet<string>
  locateIds: string[] | null
  localView: GraphLocalViewSlice<TNode, TEdge> | null
}): {
  nodes: TNode[]
  edges: TEdge[]
  pendingNodes: TNode[]
  pendingEdges: TEdge[]
  pendingSelected: Set<string>
  highlightIds: Set<string>
  highlightedEdgeIds: Set<string>
  locateIds: string[] | null
  localView: GraphLocalViewSlice<TNode, TEdge> | null
} {
  const nodeId = input.nodeId.trim()
  const removedEdgeIds = [
    ...input.edges.filter((edge) => edgeTouchesNode(edge, nodeId)).map((edge) => edge.id),
    ...(input.localView?.edges ?? [])
      .filter((edge) => edgeTouchesNode(edge, nodeId))
      .map((edge) => edge.id)
  ]
  const removedEdgeIdSet = new Set(removedEdgeIds)
  const pendingKeys = [
    graphPendingItemKey('node', nodeId),
    ...removedEdgeIds.map((id) => graphPendingItemKey('edge', id))
  ]
  return {
    nodes: input.nodes.filter((node) => node.id !== nodeId),
    edges: input.edges.filter((edge) => !edgeTouchesNode(edge, nodeId)),
    pendingNodes: input.pendingNodes.filter((node) => node.id !== nodeId),
    pendingEdges: input.pendingEdges.filter((edge) => !edgeTouchesNode(edge, nodeId)),
    pendingSelected: omitPendingKeys(input.pendingSelected, pendingKeys),
    highlightIds: omitIdFromSet(input.highlightIds, nodeId),
    highlightedEdgeIds: omitIdsFromSet(input.highlightedEdgeIds, removedEdgeIdSet),
    locateIds: input.locateIds ? input.locateIds.filter((id) => id !== nodeId) : null,
    localView: input.localView
      ? {
          nodes: input.localView.nodes.filter((node) => node.id !== nodeId),
          edges: input.localView.edges.filter((edge) => !edgeTouchesNode(edge, nodeId))
        }
      : null
  }
}

function upsertById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return current
  const seen = new Set(current.map((row) => row.id))
  const extra = incoming.filter((row) => !seen.has(row.id))
  return extra.length === 0 ? current : [...current, ...extra]
}

/** Keep refresh/review from putting back rows whose file write is still in flight. */
export function omitInFlightGraphDeletes<
  TNode extends GraphLocalNodeRef,
  TEdge extends GraphLocalEdgeRef
>(input: {
  nodes: TNode[]
  edges: TEdge[]
  pendingNodes?: TNode[]
  pendingEdges?: TEdge[]
  deletedNodeIds: ReadonlySet<string>
  deletedEdgeIds: ReadonlySet<string>
}): {
  nodes: TNode[]
  edges: TEdge[]
  pendingNodes: TNode[]
  pendingEdges: TEdge[]
} {
  const droppedNodes = input.deletedNodeIds
  const droppedEdges = input.deletedEdgeIds
  if (droppedNodes.size === 0 && droppedEdges.size === 0) {
    return {
      nodes: input.nodes,
      edges: input.edges,
      pendingNodes: input.pendingNodes ?? [],
      pendingEdges: input.pendingEdges ?? []
    }
  }
  const keepEdge = (edge: TEdge) =>
    !droppedEdges.has(edge.id) &&
    !droppedNodes.has(edge.fromId ?? '') &&
    !droppedNodes.has(edge.toId ?? '')
  return {
    nodes: input.nodes.filter((node) => !droppedNodes.has(node.id)),
    edges: input.edges.filter(keepEdge),
    pendingNodes: (input.pendingNodes ?? []).filter((node) => !droppedNodes.has(node.id)),
    pendingEdges: (input.pendingEdges ?? []).filter(keepEdge)
  }
}

/** Put only the failed delete back; keep any later edits to other nodes. */
export function restoreGraphLocalNodeDelete<
  TNode extends GraphLocalNodeRef,
  TEdge extends GraphLocalEdgeRef
>(input: {
  nodeId: string
  current: {
    nodes: TNode[]
    edges: TEdge[]
    pendingNodes: TNode[]
    pendingEdges: TEdge[]
    localView: GraphLocalViewSlice<TNode, TEdge> | null
  }
  before: {
    nodes: TNode[]
    edges: TEdge[]
    pendingNodes: TNode[]
    pendingEdges: TEdge[]
    localView: GraphLocalViewSlice<TNode, TEdge> | null
  }
}): {
  nodes: TNode[]
  edges: TEdge[]
  pendingNodes: TNode[]
  pendingEdges: TEdge[]
  localView: GraphLocalViewSlice<TNode, TEdge> | null
} {
  const nodeId = input.nodeId.trim()
  const nodes = upsertById(
    input.current.nodes,
    input.before.nodes.filter((node) => node.id === nodeId)
  )
  const edges = upsertById(
    input.current.edges,
    input.before.edges.filter((edge) => edgeTouchesNode(edge, nodeId))
  )
  const pendingNodes = upsertById(
    input.current.pendingNodes,
    input.before.pendingNodes.filter((node) => node.id === nodeId)
  )
  const pendingEdges = upsertById(
    input.current.pendingEdges,
    input.before.pendingEdges.filter((edge) => edgeTouchesNode(edge, nodeId))
  )
  const localView = input.current.localView
    ? {
        nodes: upsertById(
          input.current.localView.nodes,
          (input.before.localView?.nodes ?? []).filter((node) => node.id === nodeId)
        ),
        edges: upsertById(
          input.current.localView.edges,
          (input.before.localView?.edges ?? []).filter((edge) => edgeTouchesNode(edge, nodeId))
        )
      }
    : input.current.localView
  return { nodes, edges, pendingNodes, pendingEdges, localView }
}

export function restoreGraphLocalEdgeDelete<
  TNode extends GraphLocalNodeRef,
  TEdge extends GraphLocalEdgeRef
>(input: {
  edgeId: string
  current: {
    edges: TEdge[]
    pendingEdges: TEdge[]
    localView: GraphLocalViewSlice<TNode, TEdge> | null
  }
  before: {
    edges: TEdge[]
    pendingEdges: TEdge[]
    localView: GraphLocalViewSlice<TNode, TEdge> | null
  }
}): {
  edges: TEdge[]
  pendingEdges: TEdge[]
  localView: GraphLocalViewSlice<TNode, TEdge> | null
} {
  const edgeId = input.edgeId.trim()
  const edges = upsertById(
    input.current.edges,
    input.before.edges.filter((edge) => edge.id === edgeId)
  )
  const pendingEdges = upsertById(
    input.current.pendingEdges,
    input.before.pendingEdges.filter((edge) => edge.id === edgeId)
  )
  const localView = input.current.localView
    ? {
        ...input.current.localView,
        edges: upsertById(
          input.current.localView.edges,
          (input.before.localView?.edges ?? []).filter((edge) => edge.id === edgeId)
        )
      }
    : input.current.localView
  return { edges, pendingEdges, localView }
}

/** Drop one edge from the current graph page lists. Does not read the store. */
export function applyGraphLocalEdgeDelete<
  TNode extends GraphLocalNodeRef,
  TEdge extends GraphLocalEdgeRef
>(input: {
  edgeId: string
  edges: TEdge[]
  pendingEdges: TEdge[]
  pendingSelected: ReadonlySet<string>
  highlightedEdgeIds: ReadonlySet<string>
  localView: GraphLocalViewSlice<TNode, TEdge> | null
}): {
  edges: TEdge[]
  pendingEdges: TEdge[]
  pendingSelected: Set<string>
  highlightedEdgeIds: Set<string>
  localView: GraphLocalViewSlice<TNode, TEdge> | null
} {
  const edgeId = input.edgeId.trim()
  return {
    edges: input.edges.filter((edge) => edge.id !== edgeId),
    pendingEdges: input.pendingEdges.filter((edge) => edge.id !== edgeId),
    pendingSelected: omitPendingKeys(input.pendingSelected, [graphPendingItemKey('edge', edgeId)]),
    highlightedEdgeIds: omitIdFromSet(input.highlightedEdgeIds, edgeId),
    localView: input.localView
      ? { ...input.localView, edges: input.localView.edges.filter((edge) => edge.id !== edgeId) }
      : null
  }
}
