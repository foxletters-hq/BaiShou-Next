export function notebookGraphNodeReviewNeedsNeighborhood(input: {
  reviewStatus: 'approved' | 'rejected'
  shardMonth?: string | null
  sourceId?: string
}): boolean {
  if (input.reviewStatus === 'rejected') return true
  return !(input.shardMonth || input.sourceId || '').trim()
}

/**
 * 批量乐观更新，单次遍历 O(N + E + k)，与服务端复核的级联规则一致：
 * - 通过节点：相连的待审边一并通过，这些边的另一端若待审也通过；拒绝节点：相连的边全部拒绝
 * - 通过边：两端待审节点通过；拒绝边：只影响自身
 */
export function applyNotebookGraphLocalReviewBatch<
  N extends { id: string; reviewStatus?: string },
  E extends { id: string; fromId: string; toId: string; reviewStatus?: string }
>(input: {
  nodes: N[]
  edges: E[]
  nodeIds: readonly string[]
  edgeIds: readonly string[]
  status: 'approved' | 'rejected'
}): { nodes: N[]; edges: E[] } {
  const selectedNodes = new Set(input.nodeIds)
  const selectedEdges = new Set(input.edgeIds)
  const approved = input.status === 'approved'
  const touchesSelectedNode = (edge: E) =>
    selectedNodes.has(edge.fromId) || selectedNodes.has(edge.toId)

  // 通过时会变为「通过」的边：选中的边，以及与选中节点相连的待审边
  const endpointIds = new Set<string>()
  if (approved) {
    for (const edge of input.edges) {
      const becomesApproved =
        selectedEdges.has(edge.id) || (touchesSelectedNode(edge) && edge.reviewStatus === 'pending')
      if (!becomesApproved) continue
      endpointIds.add(edge.fromId)
      endpointIds.add(edge.toId)
    }
  }

  const edges = input.edges.map((edge) => {
    if (selectedEdges.has(edge.id)) return { ...edge, reviewStatus: input.status }
    if (!touchesSelectedNode(edge)) return edge
    if (!approved) return { ...edge, reviewStatus: 'rejected' }
    return edge.reviewStatus === 'pending' ? { ...edge, reviewStatus: 'approved' } : edge
  })
  const nodes = input.nodes.map((node) => {
    if (selectedNodes.has(node.id)) return { ...node, reviewStatus: input.status }
    if (approved && endpointIds.has(node.id) && node.reviewStatus === 'pending') {
      return { ...node, reviewStatus: 'approved' }
    }
    return node
  })
  return { nodes, edges }
}

export function applyNotebookGraphLocalReview<
  N extends { id: string; reviewStatus?: string },
  E extends { id: string; fromId: string; toId: string; reviewStatus?: string }
>(input: {
  nodes: N[]
  edges: E[]
  kind: 'node' | 'edge'
  id: string
  status: 'approved' | 'rejected'
}): { nodes: N[]; edges: E[] } {
  if (input.kind === 'node') {
    const nodes = input.nodes.map((node) =>
      node.id === input.id ? { ...node, reviewStatus: input.status } : node
    )
    const edges = input.edges.map((edge) => {
      if (edge.fromId !== input.id && edge.toId !== input.id) return edge
      if (input.status === 'rejected') return { ...edge, reviewStatus: 'rejected' }
      if (edge.reviewStatus === 'pending') return { ...edge, reviewStatus: 'approved' }
      return edge
    })
    return { nodes, edges }
  }

  const edges = input.edges.map((edge) =>
    edge.id === input.id ? { ...edge, reviewStatus: input.status } : edge
  )
  if (input.status !== 'approved') return { nodes: input.nodes, edges }

  const reviewed = input.edges.find((edge) => edge.id === input.id)
  if (!reviewed) return { nodes: input.nodes, edges }
  const endpoints = new Set([reviewed.fromId, reviewed.toId])
  const nodes = input.nodes.map((node) =>
    endpoints.has(node.id) && node.reviewStatus === 'pending'
      ? { ...node, reviewStatus: 'approved' }
      : node
  )
  return { nodes, edges }
}
