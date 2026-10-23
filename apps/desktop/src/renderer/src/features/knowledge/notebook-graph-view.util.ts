import { remapGraphViewReviewForDisplay } from '@baishou/shared'

export type NotebookGraphViewNode = {
  id: string
  name: string
  nodeType: string
  mentionCount?: number
  reviewStatus?: string
  summary?: string
}

export type NotebookGraphViewEdge = {
  id: string
  fromId: string
  toId: string
  edgeType: string
  reviewStatus?: string
  confidence?: number
  sourceRef?: string | null
  sourceExcerpt?: string
}

export function remapNotebookGraphReviewForDisplay(
  nodes: NotebookGraphViewNode[],
  edges: NotebookGraphViewEdge[]
): { nodes: NotebookGraphViewNode[]; edges: NotebookGraphViewEdge[] } {
  return remapGraphViewReviewForDisplay(nodes, edges)
}

export function splitNotebookGraphPending(
  nodes: NotebookGraphViewNode[],
  edges: NotebookGraphViewEdge[]
): {
  pendingNodes: NotebookGraphViewNode[]
  pendingEdges: NotebookGraphViewEdge[]
} {
  return {
    pendingNodes: nodes.filter((node) => node.reviewStatus === 'pending'),
    pendingEdges: edges.filter((edge) => edge.reviewStatus === 'pending')
  }
}
