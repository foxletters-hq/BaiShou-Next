export type NotebookOrganizeFabKind = 'loading' | 'running' | 'pending' | 'idle'

const DONE_SOURCE_STATUSES = new Set(['ready', 'partial'])
const OPEN_GRAPH_STATUSES = new Set(['pending', 'running', 'failed'])

export function notebookOrganizePendingSourceCount(input: {
  sources: Array<{ id: string; status: string }>
  graphJobItems?: Array<{ sourceId: string; status: string }>
}): number {
  const ids = new Set<string>()
  const graphBySource = new Map(
    (input.graphJobItems ?? []).map((item) => [item.sourceId, item.status])
  )
  for (const source of input.sources) {
    if (!DONE_SOURCE_STATUSES.has(source.status)) {
      ids.add(source.id)
      continue
    }
    const graph = graphBySource.get(source.id)
    if (graph && OPEN_GRAPH_STATUSES.has(graph)) ids.add(source.id)
  }
  for (const item of input.graphJobItems ?? []) {
    if (OPEN_GRAPH_STATUSES.has(item.status)) ids.add(item.sourceId)
  }
  return ids.size
}

export function knowledgeOrganizeHasLiveWork(input: {
  ingestingCount: number
  sources: Array<{ status: string; id?: string }>
  graphJobItems?: Array<{ status: string }>
  ingestJobItems?: Array<{ status: string }>
  ocrProgressBySource?: Record<string, unknown>
}): boolean {
  if ((input.graphJobItems ?? []).some((item) => item.status === 'running')) return true
  if ((input.ingestJobItems ?? []).some((item) => item.status === 'running')) return true
  return false
}

/** 入队或正在跑的任务；失败不算，方便整理结束后关掉 watching。 */
export function notebookOrganizeHasActiveJobs(input: {
  ingestingCount: number
  sources: Array<{ status: string; id?: string }>
  graphJobItems?: Array<{ status: string }>
  ingestJobItems?: Array<{ status: string }>
  ocrProgressBySource?: Record<string, unknown>
}): boolean {
  if (knowledgeOrganizeHasLiveWork(input)) return true
  const jobs = [...(input.graphJobItems ?? []), ...(input.ingestJobItems ?? [])]
  return jobs.some((item) => item.status === 'pending' || item.status === 'running')
}

const QUEUED_SOURCE_STATUSES = new Set([
  'stored',
  'pending',
  'needs_ocr',
  'extracting',
  'embedding'
])

/** 用户点过开始整理后：资料还没就绪就接着看，不要因为 job 列表空了就退回「开始整理」。 */
export function notebookOrganizeShouldKeepWatching(input: {
  ingestingCount: number
  sources: Array<{ status: string; id?: string }>
  graphJobItems?: Array<{ status: string }>
  ingestJobItems?: Array<{ status: string }>
  ocrProgressBySource?: Record<string, unknown>
}): boolean {
  if (notebookOrganizeHasActiveJobs(input)) return true
  return input.sources.some((source) => QUEUED_SOURCE_STATUSES.has(source.status))
}

/** 右下角 FAB：只有提取/嵌入/抽图真正在跑才禁用；排队中的 pending 仍可点开始整理。 */
export function resolveNotebookOrganizeFabState(input: {
  sourcesReady: boolean
  busy?: boolean
  watching?: boolean
  ingestingCount: number
  sources: Array<{ id: string; status: string }>
  graphJobItems?: Array<{ sourceId: string; status: string }>
  ingestJobItems?: Array<{ status: string }>
  ocrProgressBySource?: Record<string, unknown>
}): { kind: NotebookOrganizeFabKind; pendingCount: number } {
  if (!input.sourcesReady) return { kind: 'loading', pendingCount: 0 }
  const pendingCount = notebookOrganizePendingSourceCount(input)
  const running =
    Boolean(input.busy) ||
    knowledgeOrganizeHasLiveWork(input) ||
    Boolean(input.watching && pendingCount > 0)
  if (running) return { kind: 'running', pendingCount }
  if (pendingCount > 0) return { kind: 'pending', pendingCount }
  return { kind: 'idle', pendingCount: 0 }
}
