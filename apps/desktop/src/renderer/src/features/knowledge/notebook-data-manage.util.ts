export type NotebookDataManageAction = 'clear' | 'reprocess'
export type NotebookDataManageTarget = 'vector' | 'graph'
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

export function notebookDataManageHasTarget(input: {
  vector: boolean
  graph: boolean
}): boolean {
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

export function listNotebookDataManageSteps(input: {
  action: NotebookDataManageAction
  vector: boolean
  graph: boolean
}): NotebookDataManageStep[] {
  if (!notebookDataManageHasTarget(input)) return []
  if (input.action === 'clear') {
    return [
      ...(input.vector ? (['clear-vector'] as const) : []),
      ...(input.graph ? (['clear-graph'] as const) : [])
    ]
  }
  return [
    ...(input.vector ? (['reprocess-vector'] as const) : []),
    ...(input.graph ? (['reprocess-graph'] as const) : [])
  ]
}

function asNonNegInt(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

export function parseNotebookDataManageResult(raw: unknown): NotebookDataManageResult | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (!('sourceCount' in row) || !('vectorQueued' in row) || !('graphQueued' in row)) return null
  return {
    action: row.action === 'clear' ? 'clear' : 'reprocess',
    vector: Boolean(row.vector),
    graph: Boolean(row.graph),
    sourceCount: asNonNegInt(row.sourceCount),
    vectorQueued: asNonNegInt(row.vectorQueued),
    graphQueued: asNonNegInt(row.graphQueued)
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

export function notebookDataManageFeedback(
  kind: NotebookDataManageStatusKind
): 'toast' | 'banner' {
  return kind === 'reprocess-empty' || kind === 'reprocess-none' ? 'toast' : 'banner'
}

export function notebookDataManageWatch(result: NotebookDataManageResult): {
  watch: boolean
  vectorQueued: number
  graphQueued: number
} {
  const vectorQueued = Math.max(0, result.vectorQueued)
  const graphQueued = Math.max(0, result.graphQueued)
  return {
    watch: result.action === 'reprocess' && vectorQueued + graphQueued > 0,
    vectorQueued,
    graphQueued
  }
}
