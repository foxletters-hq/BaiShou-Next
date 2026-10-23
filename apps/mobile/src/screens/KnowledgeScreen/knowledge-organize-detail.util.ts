import { splitKnowledgeSourceErrorMessage } from '@baishou/shared'
import type {
  KnowledgeOrganizeDetailSource,
  KnowledgeOrganizeJobItem,
  KnowledgeOrganizePhaseRow,
  KnowledgeOrganizeProcessLine,
  KnowledgeOrganizeProgress
} from './knowledge-organize.types'
import { knowledgeOrganizeSourcePhases } from './knowledge-organize-phases.util'

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
  ocrProgressBySource: Record<string, KnowledgeOrganizeProgress>
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
  ocrProgressBySource: Record<string, KnowledgeOrganizeProgress>
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
