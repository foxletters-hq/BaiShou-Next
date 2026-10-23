import type {
  KnowledgeOrganizeJobItem,
  KnowledgeOrganizePhaseRow,
  KnowledgeOrganizeProgress,
  KnowledgeOrganizeTaskAction
} from './knowledge-organize.types'

function isGraphPhase(phase?: string): boolean {
  return phase === 'graph'
}

function isExtractPhase(phase?: string): boolean {
  return (
    phase === 'ocr' ||
    phase === 'vision' ||
    phase === 'render' ||
    phase === 'parse' ||
    phase === 'recognize' ||
    phase === 'extract'
  )
}

function isEmbedPhase(phase?: string): boolean {
  return phase === 'embed'
}

function progressCounts(
  progress: KnowledgeOrganizeProgress | undefined,
  match: (phase?: string) => boolean
): { completed: number; total: number } {
  if (!progress || !match(progress.phase)) return { completed: 0, total: 0 }
  return { completed: Math.max(0, progress.page), total: Math.max(0, progress.total) }
}

function pageSpan(
  input?: {
    pageFrom?: number
    pageTo?: number
    pageTotal?: number
  } | null
): { pageFrom: number; pageTo: number; pageTotal: number } | null {
  const pageTotal = Math.max(0, input?.pageTotal ?? 0)
  const pageTo = Math.min(pageTotal, Math.max(0, input?.pageTo ?? 0))
  if (pageTotal <= 0 || pageTo <= 0) return null
  const rawFrom = Math.max(0, input?.pageFrom ?? 0)
  return {
    pageFrom: Math.min(pageTo, rawFrom > 0 ? rawFrom : pageTo),
    pageTo,
    pageTotal
  }
}

function graphProgressCounts(
  progress: KnowledgeOrganizeProgress | undefined,
  job?: KnowledgeOrganizeJobItem | null
): Pick<KnowledgeOrganizePhaseRow, 'completed' | 'total' | 'pageFrom' | 'pageTo' | 'pageTotal'> {
  const pages = pageSpan(progress) || pageSpan(job)
  if (pages) {
    return {
      completed: pages.pageTo,
      total: pages.pageTotal,
      pageFrom: pages.pageFrom,
      pageTo: pages.pageTo,
      pageTotal: pages.pageTotal
    }
  }
  const windowsTotal = Math.max(0, progress?.windowsTotal ?? job?.windowsTotal ?? 0)
  const windowsDone = Math.max(0, progress?.windowsDone ?? job?.windowsDone ?? 0)
  if (windowsTotal > 0) return { completed: windowsDone, total: windowsTotal }
  return progressCounts(progress, isGraphPhase)
}

function nodeProgressCounts(
  progress: KnowledgeOrganizeProgress | undefined,
  job?: KnowledgeOrganizeJobItem | null
): { completed: number; total: number } {
  const total = Math.max(0, progress?.nodesTotal ?? job?.nodesTotal ?? 0)
  const completed = Math.min(total, Math.max(0, progress?.nodesDone ?? job?.nodesDone ?? 0))
  return { completed, total }
}

function withCounts(row: KnowledgeOrganizePhaseRow): KnowledgeOrganizePhaseRow {
  if (row.pageFrom == null && row.pageTo == null && row.pageTotal == null) {
    return { id: row.id, status: row.status, completed: row.completed, total: row.total }
  }
  return row
}

/** 一份资料的提取 / 嵌入 / 抽图。排队中的阶段保持等待，正在跑的才带具体进度。 */
export function knowledgeOrganizeSourcePhases(input: {
  watching?: boolean
  sourceStatus: string
  ingestProgress?: KnowledgeOrganizeProgress
  extractJobStatus?: string | null
  embedJobStatus?: string | null
  graphJobStatus?: string | null
  graphJob?: KnowledgeOrganizeJobItem | null
  pageCount?: number | null
}): KnowledgeOrganizePhaseRow[] {
  const progress = input.ingestProgress
  const watching = Boolean(input.watching)
  const extractBusy =
    input.extractJobStatus === 'running' ||
    (watching && input.sourceStatus === 'extracting') ||
    (watching &&
      isExtractPhase(progress?.phase) &&
      (input.sourceStatus === 'extracting' ||
        input.sourceStatus === 'pending' ||
        input.sourceStatus === 'stored' ||
        input.sourceStatus === 'needs_ocr'))
  const embedBusy =
    input.embedJobStatus === 'running' ||
    (watching && input.sourceStatus === 'embedding') ||
    (watching && isEmbedPhase(progress?.phase) && input.sourceStatus === 'embedding')
  const graphFailed = input.graphJobStatus === 'failed'
  const graphRunning = input.graphJobStatus === 'running'
  const graphOpen = input.graphJobStatus === 'pending' || graphRunning || graphFailed
  const laterBusy = embedBusy || graphOpen
  const ready = input.sourceStatus === 'ready' || input.sourceStatus === 'partial'
  const graphCounts = graphProgressCounts(progress, input.graphJob)
  const pageTotal = Math.max(0, input.pageCount ?? 0)
  const queuedGraphCounts =
    graphCounts.total > 0
      ? graphCounts
      : pageTotal > 0
        ? { completed: 0, total: pageTotal }
        : { completed: 0, total: 0 }
  const nodeCounts = nodeProgressCounts(progress, input.graphJob)
  // 进度里的窗口序号是「正在抽的这一窗」，抽到最后一窗时 completed 也会等于 total。
  // 节点总量出现之前，抽图都还在进行，不能切到没有数字的节点向量。
  const nodeEmbedStarted = nodeCounts.total > 0
  const graphExtractDone = graphCounts.total > 0 && graphCounts.completed >= graphCounts.total

  const extract: KnowledgeOrganizePhaseRow = extractBusy
    ? { id: 'extract', status: 'running', ...progressCounts(progress, isExtractPhase) }
    : laterBusy || ready
      ? { id: 'extract', status: 'done', completed: 0, total: 0 }
      : input.extractJobStatus === 'failed' || input.sourceStatus === 'failed'
        ? { id: 'extract', status: 'failed', completed: 0, total: 0 }
        : { id: 'extract', status: 'pending', completed: 0, total: 0 }

  const embed: KnowledgeOrganizePhaseRow = embedBusy
    ? { id: 'embed', status: 'running', ...progressCounts(progress, isEmbedPhase) }
    : extractBusy
      ? { id: 'embed', status: 'pending', completed: 0, total: 0 }
      : input.embedJobStatus === 'pending'
        ? { id: 'embed', status: 'pending', completed: 0, total: 0 }
        : graphOpen || ready
          ? { id: 'embed', status: 'done', completed: 0, total: 0 }
          : input.embedJobStatus === 'failed'
            ? { id: 'embed', status: 'failed', completed: 0, total: 0 }
            : { id: 'embed', status: 'pending', completed: 0, total: 0 }

  const graph: KnowledgeOrganizePhaseRow = graphFailed
    ? {
        id: 'graph',
        status: nodeEmbedStarted || graphExtractDone ? 'done' : 'failed',
        ...queuedGraphCounts
      }
    : graphRunning && !(nodeEmbedStarted && graphExtractDone)
      ? { id: 'graph', status: 'running', ...queuedGraphCounts }
      : graphRunning
        ? { id: 'graph', status: 'done', ...queuedGraphCounts }
        : { id: 'graph', status: 'pending', ...queuedGraphCounts }

  const graphNodes: KnowledgeOrganizePhaseRow =
    graphFailed && (nodeEmbedStarted || graphExtractDone)
      ? { id: 'graphNodes', status: 'failed', ...nodeCounts }
      : nodeEmbedStarted
        ? {
            id: 'graphNodes',
            status: nodeCounts.completed >= nodeCounts.total ? 'done' : 'running',
            ...nodeCounts
          }
        : { id: 'graphNodes', status: 'pending', completed: 0, total: 0 }

  return [extract, embed, withCounts(graph), graphNodes]
}

export function knowledgeOrganizeCurrentPhase(
  phases: KnowledgeOrganizePhaseRow[]
): KnowledgeOrganizePhaseRow | null {
  return (
    phases.find((phase) => phase.status === 'running') ||
    phases.find((phase) => phase.status === 'failed') ||
    phases.find((phase) => phase.status === 'pending') ||
    null
  )
}

export function knowledgeOrganizeRestartTarget(
  phases: KnowledgeOrganizePhaseRow[]
): 'extract' | 'embed' | 'graph' {
  const extract = phases.find((phase) => phase.id === 'extract')
  const embed = phases.find((phase) => phase.id === 'embed')
  if (extract && extract.status !== 'done') return 'extract'
  if (embed && embed.status !== 'done') return 'embed'
  return 'graph'
}

export function knowledgeOrganizeTaskActions(
  phases: KnowledgeOrganizePhaseRow[]
): KnowledgeOrganizeTaskAction[] {
  const current = knowledgeOrganizeCurrentPhase(phases)
  if (!current) return []
  if (current.status === 'failed') return ['restart']
  return ['restart', 'cancel']
}
