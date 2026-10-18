import { splitKnowledgeSourceErrorMessage } from '@baishou/shared'

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

export type KnowledgeOrganizePhaseId = 'extract' | 'embed' | 'graph' | 'graphNodes'
export type KnowledgeOrganizePhaseStatus = 'pending' | 'running' | 'done' | 'failed'

export type KnowledgeOrganizePhaseRow = {
  id: KnowledgeOrganizePhaseId
  status: KnowledgeOrganizePhaseStatus
  completed: number
  total: number
  pageFrom?: number
  pageTo?: number
  pageTotal?: number
}

export type KnowledgeOrganizeProcessLine = {
  sourceId: string
  title: string
  phase: KnowledgeOrganizePhaseId
  status: KnowledgeOrganizePhaseStatus
  detail?: string
  completed?: number
  total?: number
  pageFrom?: number
  pageTo?: number
  pageTotal?: number
}

export type KnowledgeOrganizeDetailSource = {
  sourceId: string
  title: string
  error?: string
  hint?: string
  phases: KnowledgeOrganizePhaseRow[]
}

export type KnowledgeOrganizeJobItem = {
  sourceId: string
  title: string
  stage?: string
  status: string
  lastError?: string | null
  windowsDone?: number
  windowsTotal?: number
  nodesDone?: number
  nodesTotal?: number
  pageFrom?: number
  pageTo?: number
  pageTotal?: number
}

type OrganizeProgress = {
  page: number
  total: number
  phase?: string
  windowsDone?: number
  windowsTotal?: number
  nodesDone?: number
  nodesTotal?: number
  pageFrom?: number
  pageTo?: number
  pageTotal?: number
}

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

function jobStatus(
  items: KnowledgeOrganizeJobItem[] | undefined,
  sourceId: string,
  stage: string
): string | null {
  return (
    items?.find((item) => item.sourceId === sourceId && (item.stage || 'graph') === stage)
      ?.status ?? null
  )
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

function progressCounts(
  progress: OrganizeProgress | undefined,
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
  progress: OrganizeProgress | undefined,
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
  progress: OrganizeProgress | undefined,
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
  ingestProgress?: OrganizeProgress
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

export type KnowledgeOrganizeTaskAction = 'restart' | 'cancel'

export function knowledgeOrganizeTaskActions(
  phases: KnowledgeOrganizePhaseRow[]
): KnowledgeOrganizeTaskAction[] {
  const current = knowledgeOrganizeCurrentPhase(phases)
  if (!current) return []
  if (current.status === 'failed') return ['restart']
  return ['restart', 'cancel']
}

function currentProcessLine(
  sourceId: string,
  title: string,
  phases: KnowledgeOrganizePhaseRow[]
): KnowledgeOrganizeProcessLine | null {
  const current =
    phases.find((phase) => phase.status === 'running') ||
    phases.find((phase) => phase.status === 'failed') ||
    phases.find((phase) => phase.status === 'pending')
  if (!current) return null
  const line: KnowledgeOrganizeProcessLine = {
    sourceId,
    title,
    phase: current.id,
    status: current.status
  }
  if (current.total > 0) {
    line.detail = `${current.completed}/${current.total}`
    line.completed = current.completed
    line.total = current.total
  }
  if (current.pageFrom != null && current.pageTo != null && current.pageTotal != null) {
    line.pageFrom = current.pageFrom
    line.pageTo = current.pageTo
    line.pageTotal = current.pageTotal
  }
  return line
}

export function knowledgeOrganizeDetailSources(input: {
  watching?: boolean
  sources: Array<{
    id: string
    title: string
    status: string
    errorMessage?: string | null
    pageCount?: number | null
  }>
  graphJobItems: KnowledgeOrganizeJobItem[]
  ocrProgressBySource: Record<string, OrganizeProgress>
  ingestJobItems?: KnowledgeOrganizeJobItem[]
}): KnowledgeOrganizeDetailSource[] {
  const ingestJobItems = input.ingestJobItems ?? []
  const byId = new Map<
    string,
    { title: string; status: string; errorMessage?: string | null; pageCount?: number | null }
  >()
  for (const source of input.sources) {
    byId.set(source.id, source)
  }
  for (const item of [...ingestJobItems, ...input.graphJobItems]) {
    if (!byId.has(item.sourceId)) {
      byId.set(item.sourceId, { title: item.title, status: 'pending' })
    }
  }
  for (const sourceId of Object.keys(input.ocrProgressBySource)) {
    if (!byId.has(sourceId)) byId.set(sourceId, { title: sourceId, status: 'pending' })
  }

  const rows: KnowledgeOrganizeDetailSource[] = []
  for (const [sourceId, source] of byId) {
    if (
      (source.status === 'ready' || source.status === 'partial') &&
      !ingestJobItems.some((item) => item.sourceId === sourceId) &&
      !input.graphJobItems.some((item) => item.sourceId === sourceId)
    ) {
      continue
    }
    const organizing =
      source.status === 'pending' ||
      source.status === 'stored' ||
      source.status === 'needs_ocr' ||
      source.status === 'extracting' ||
      source.status === 'embedding' ||
      source.status === 'failed' ||
      Boolean(input.ocrProgressBySource[sourceId]) ||
      ingestJobItems.some((item) => item.sourceId === sourceId) ||
      input.graphJobItems.some((item) => item.sourceId === sourceId)
    if (!organizing) continue
    if (
      !input.watching &&
      source.status === 'stored' &&
      !ingestJobItems.some((item) => item.sourceId === sourceId) &&
      !input.graphJobItems.some((item) => item.sourceId === sourceId) &&
      !input.ocrProgressBySource[sourceId]
    ) {
      continue
    }
    const graph = input.graphJobItems.find((item) => item.sourceId === sourceId)
    const phases = knowledgeOrganizeSourcePhases({
      watching: input.watching,
      sourceStatus: source.status,
      ingestProgress: input.ocrProgressBySource[sourceId],
      extractJobStatus: jobStatus(ingestJobItems, sourceId, 'extract'),
      embedJobStatus: jobStatus(ingestJobItems, sourceId, 'embed'),
      graphJobStatus: graph?.status ?? jobStatus(ingestJobItems, sourceId, 'graph'),
      graphJob: graph,
      pageCount: source.pageCount
    })
    const split = splitKnowledgeSourceErrorMessage(
      graph?.lastError?.trim() || source.errorMessage?.trim() || ''
    )
    rows.push({
      sourceId,
      title: source.title,
      error: split.error ?? undefined,
      hint: split.hint ?? undefined,
      phases
    })
  }
  return rows
}

export function knowledgeOrganizeFailedMessage(
  sources: KnowledgeOrganizeDetailSource[]
): string | undefined {
  for (const row of sources) {
    if (row.phases.some((phase) => phase.status === 'failed') && row.error) return row.error
  }
  return sources.find((row) => row.error)?.error
}

export function knowledgeOrganizeProcessLines(input: {
  watching?: boolean
  sources: Array<{ id: string; title: string; status: string; pageCount?: number | null }>
  graphJobItems: KnowledgeOrganizeJobItem[]
  ocrProgressBySource: Record<string, OrganizeProgress>
  ingestJobItems?: KnowledgeOrganizeJobItem[]
}): KnowledgeOrganizeProcessLine[] {
  return knowledgeOrganizeDetailSources(input)
    .map((row) => currentProcessLine(row.sourceId, row.title, row.phases))
    .filter((line): line is KnowledgeOrganizeProcessLine => Boolean(line))
}

export function knowledgeOrganizeRememberedTotal(
  previous: number,
  currentCount: number,
  watching: boolean
): number {
  if (!watching) return 0
  return Math.max(0, previous, currentCount)
}

function phaseFraction(phase: KnowledgeOrganizePhaseRow): number {
  if (phase.status === 'done' || phase.status === 'failed') return 1
  if (phase.status === 'running' && phase.total > 0) {
    return Math.min(1, Math.max(0, phase.completed / phase.total))
  }
  if (phase.status === 'running') return 0.05
  return 0
}

function sourceFraction(phases: KnowledgeOrganizePhaseRow[]): number {
  if (phases.length === 0) return 0
  return phases.reduce((sum, phase) => sum + phaseFraction(phase), 0) / phases.length
}

export function knowledgeOrganizeBannerProgress(input: {
  knownTotal?: number
  sources: KnowledgeOrganizeDetailSource[]
}): { done: number; total: number; percent: number } {
  const current = input.sources.length
  const total = Math.max(0, input.knownTotal ?? current, current)
  const finished = Math.max(0, total - current)
  const fraction = input.sources.reduce((sum, row) => sum + sourceFraction(row.phases), 0)
  const percent =
    total <= 0 ? 0 : Math.min(100, Math.max(0, Math.round(((finished + fraction) / total) * 100)))
  return { done: finished, total, percent }
}

export function knowledgeOrganizeBannerKind(input: {
  watching?: boolean
  ingestingCount: number
  pendingJobs: number
  graphJobItems: Array<{ status: string }>
  ocrProgressBySource: Record<string, { page: number; total: number; phase?: string }>
  ingestJobItems?: Array<{ status: string }>
}): 'running' | 'failed' | 'paused' | 'idle' {
  const jobs = [...input.graphJobItems, ...(input.ingestJobItems ?? [])]
  const hasLiveJobs = jobs.some((item) => item.status === 'running')
  const hasQueuedJobs = jobs.some((item) => item.status === 'pending' || item.status === 'running')
  const hasFailedJobs = jobs.some((item) => item.status === 'failed')
  const leftoverBusy = input.ingestingCount > 0 || hasQueuedJobs || input.pendingJobs > 0
  if (hasLiveJobs) return 'running'
  if (input.watching && leftoverBusy) return 'running'
  if (hasFailedJobs) return 'failed'
  if (leftoverBusy) return 'paused'
  return 'idle'
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
