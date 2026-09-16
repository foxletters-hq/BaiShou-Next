import {
  notebookGraphProgressCopy,
  type NotebookGraphJobSnapshot,
  type NotebookGraphProgressCopy
} from './notebook-graph-progress.util'

export type NotebookVectorJobCopy = {
  detailKey: string
  detailParams: Record<string, number>
  percent: number | null
}

export type NotebookJobProgressCopy = {
  visible: boolean
  vector: NotebookVectorJobCopy | null
  graph: NotebookGraphProgressCopy | null
}

export function notebookJobProgressCopy(input: {
  vectorActive: number
  vectorKnownTotal?: number
  graph: NotebookGraphJobSnapshot
}): NotebookJobProgressCopy {
  const graph = notebookGraphProgressCopy(input.graph)
  const vectorActive = Math.max(0, input.vectorActive)
  const vectorTotal = Math.max(0, input.vectorKnownTotal ?? 0, vectorActive)
  const vector: NotebookVectorJobCopy | null =
    vectorActive > 0
      ? {
          detailKey:
            vectorTotal > vectorActive
              ? 'knowledge.job_vector_done_of'
              : 'knowledge.job_vector_active',
          detailParams:
            vectorTotal > vectorActive
              ? { done: vectorTotal - vectorActive, total: vectorTotal }
              : { count: vectorActive },
          percent:
            vectorTotal > 0
              ? Math.min(100, Math.round(((vectorTotal - vectorActive) / vectorTotal) * 100))
              : null
        }
      : null

  return {
    visible: vector != null || graph.visible,
    vector,
    graph: graph.visible ? graph : null
  }
}
