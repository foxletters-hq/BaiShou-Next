import type { KnowledgeOrganizeJobItem } from './knowledge-organize.types'

export function knowledgeOrganizeSourceCount(input: {
  ingestingCount: number
  pendingJobs: number
  graphJobItems: Array<{ sourceId: string }>
  ingestJobItems?: Array<{ sourceId: string }>
  ocrProgressBySource: Record<string, { page: number; total: number; phase?: string }>
}): number {
  const ids = new Set<string>()
  for (const item of [...input.graphJobItems, ...(input.ingestJobItems ?? [])]) {
    if (item.sourceId) ids.add(item.sourceId)
  }
  for (const sourceId of Object.keys(input.ocrProgressBySource)) ids.add(sourceId)
  const fromSources = Math.max(ids.size, Math.max(0, input.ingestingCount))
  if (fromSources > 0) return fromSources
  return Math.max(0, input.pendingJobs)
}

export function knowledgeOrganizeProgressPercent(
  ocrProgressBySource: Record<string, { page: number; total: number; phase?: string }>
): number {
  const rows = Object.values(ocrProgressBySource).filter((row) => row.total > 0)
  if (rows.length === 0) return 0
  const page = rows.reduce((sum, row) => sum + Math.max(0, row.page), 0)
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.total), 0)
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, (page / total) * 100))
}

export function overlayOrganizeJobsLiveStatus<T extends { sourceId: string; status: string }>(
  items: T[],
  liveSourceIds: Iterable<string>
): T[] {
  const live = new Set(liveSourceIds)
  return items.map((item) => {
    if (item.status === 'failed') return item
    if (live.has(item.sourceId)) return { ...item, status: 'running' }
    // 进程已经没了，库里还写着 running：按排队中断处理，不要假装仍在整理。
    if (item.status === 'running') return { ...item, status: 'pending' }
    return item
  })
}

export function mergeKnowledgeOrganizeJobProgress(
  next: KnowledgeOrganizeJobItem[],
  prev: KnowledgeOrganizeJobItem[]
): KnowledgeOrganizeJobItem[] {
  const prevBy = new Map(prev.map((item) => [`${item.sourceId}:${item.stage || ''}`, item]))
  return next.map((item) => {
    const old = prevBy.get(`${item.sourceId}:${item.stage || ''}`)
    if (!old) return item
    return {
      ...item,
      windowsDone: item.windowsDone ?? old.windowsDone,
      windowsTotal: item.windowsTotal ?? old.windowsTotal,
      nodesDone: item.nodesDone ?? old.nodesDone,
      nodesTotal: item.nodesTotal ?? old.nodesTotal,
      pageFrom: item.pageFrom ?? old.pageFrom,
      pageTo: item.pageTo ?? old.pageTo,
      pageTotal: item.pageTotal ?? old.pageTotal
    }
  })
}

/** 整理进度只保留最新一条，避免抽图并发把页面刷死。 */
export function createLatestThrottled<T>(
  waitMs: number,
  fn: (value: T) => void
): { push: (value: T) => void; flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: T | undefined
  let hasPending = false
  const flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (!hasPending) return
    hasPending = false
    fn(pending as T)
  }
  return {
    push: (value: T) => {
      pending = value
      hasPending = true
      if (timer) return
      timer = setTimeout(flush, waitMs)
    },
    flush
  }
}
