import type { NotebookGraphViewEdge, NotebookGraphViewNode } from './notebook-graph-view.util'

export type NotebookGraphViewSnapshot = {
  key: string
  nodes: NotebookGraphViewNode[]
  edges: NotebookGraphViewEdge[]
}

let lastNotebookGraphView: NotebookGraphViewSnapshot | null = null

const notebookGraphViewKey = (notebookId: string, maxNodes: number) => `${notebookId}:${maxNodes}`

export function readNotebookGraphViewCache(
  notebookId: string,
  maxNodes: number
): NotebookGraphViewSnapshot | null {
  if (!notebookId) return null
  const key = notebookGraphViewKey(notebookId, maxNodes)
  return lastNotebookGraphView?.key === key ? lastNotebookGraphView : null
}

export function writeNotebookGraphViewCache(
  notebookId: string,
  maxNodes: number,
  nodes: NotebookGraphViewNode[],
  edges: NotebookGraphViewEdge[]
): void {
  lastNotebookGraphView = { key: notebookGraphViewKey(notebookId, maxNodes), nodes, edges }
}
