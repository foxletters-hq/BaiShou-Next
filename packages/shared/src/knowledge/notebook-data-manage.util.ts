export type NotebookDataManageAction = 'clear' | 'reprocess'
export type NotebookDataManageStep =
  | 'clear-vector'
  | 'clear-graph'
  | 'reprocess-vector'
  | 'reprocess-graph'
export type NotebookDataManageStatusKind =
  | 'cleared'
  | 'reprocess-empty'
  | 'reprocess-none'
  | 'reprocess-queued'
export type NotebookDataManageResult = {
  action: NotebookDataManageAction
  vector: boolean
  graph: boolean
  sourceCount: number
  vectorQueued: number
  graphQueued: number
}

export function notebookDataManageHasTarget(input: { vector: boolean; graph: boolean }): boolean {
  return input.vector || input.graph
}

export function canConfirmNotebookDataManage(input: {
  action: NotebookDataManageAction
  vector: boolean
  graph: boolean
  phrase: string
  typed: string
}): boolean {
  if (!notebookDataManageHasTarget(input)) return false
  if (input.action === 'clear') return input.typed === input.phrase
  return true
}

export function parseNotebookDataManageResult(raw: unknown): NotebookDataManageResult | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (!('sourceCount' in row) || !('vectorQueued' in row) || !('graphQueued' in row)) return null
  return {
    action: row.action === 'clear' ? 'clear' : 'reprocess',
    vector: Boolean(row.vector),
    graph: Boolean(row.graph),
    sourceCount: Number.isFinite(Number(row.sourceCount))
      ? Math.max(0, Math.floor(Number(row.sourceCount)))
      : 0,
    vectorQueued: Number.isFinite(Number(row.vectorQueued))
      ? Math.max(0, Math.floor(Number(row.vectorQueued)))
      : 0,
    graphQueued: Number.isFinite(Number(row.graphQueued))
      ? Math.max(0, Math.floor(Number(row.graphQueued)))
      : 0
  }
}

export function notebookDataManageQueuedTotal(
  result: Pick<NotebookDataManageResult, 'vectorQueued' | 'graphQueued'>
): number {
  return Math.max(0, result.vectorQueued) + Math.max(0, result.graphQueued)
}

export function notebookDataManageStatusKind(
  result: NotebookDataManageResult
): NotebookDataManageStatusKind {
  if (result.action === 'clear') return 'cleared'
  if (notebookDataManageQueuedTotal(result) > 0) return 'reprocess-queued'
  return result.sourceCount <= 0 ? 'reprocess-empty' : 'reprocess-none'
}
