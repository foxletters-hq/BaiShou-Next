import { parseKnowledgeGraphStepError } from '@baishou/shared'
import { graphPageSpan } from './notebook-graph-progress.util'
import type {
  KnowledgeIngestProgress,
  KnowledgeOrganizePhaseRow,
  KnowledgeOrganizeSource
} from './notebook-job-progress.util'

export type KnowledgeGraphJobForSource = {
  status: string
  lastError?: string | null
  windowsDone?: number
  windowsTotal?: number
  pageFrom?: number
  pageTo?: number
  pageTotal?: number
}

export type KnowledgeOrganizeSourceRow = {
  sourceId: string
  title: string
  phases: KnowledgeOrganizePhaseRow[]
  failed: boolean
  error: string | null
}

function isEmbedPhase(phase?: string): boolean {
  return phase === 'embed'
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

export function isKnowledgeGraphJobOpen(status?: string | null): boolean {
  return status === 'pending' || status === 'running' || status === 'failed'
}

export function knowledgeOrganizeSourceSummary(
  phases: KnowledgeOrganizePhaseRow[]
): KnowledgeOrganizePhaseRow['id'] | 'failed' | 'queued' {
  if (phases.some((row) => row.status === 'failed')) return 'failed'
  return phases.find((row) => row.status === 'running')?.id ?? 'queued'
}

/** 已点开的来源仍在列表里就留下；否则打开正在跑的那一份。 */
export function knowledgeOrganizeDefaultSourceId(
  rows: KnowledgeOrganizeSourceRow[],
  current?: string | null
): string | null {
  if (current && rows.some((row) => row.sourceId === current)) return current
  return (
    rows.find((row) => row.phases.some((phase) => phase.status === 'running'))?.sourceId ??
    rows[0]?.sourceId ??
    null
  )
}

/** 一份资料自己的提取 / 嵌入 / 抽图 / 节点向量，不跟笔记本里其他资料混在一起。 */
export function notebookOrganizeSourceRow(input: {
  source: KnowledgeOrganizeSource
  ingestProgress?: KnowledgeIngestProgress
  graphJob?: KnowledgeGraphJobForSource | null
}): KnowledgeOrganizeSourceRow {
  const source = input.source
  const ingest = input.ingestProgress
  const extractBusy = source.status === 'extracting' || isExtractPhase(ingest?.phase)
  const embedBusy = source.status === 'embedding' || isEmbedPhase(ingest?.phase)
  const graphJob = input.graphJob
  const graphOpen = isKnowledgeGraphJobOpen(graphJob?.status)
  const graphError = graphJob?.lastError?.trim() || null
  const failedStep = parseKnowledgeGraphStepError(graphError)?.step ?? null
  const windowsTotal = Math.max(0, graphJob?.windowsTotal ?? 0)
  const windowsDone = Math.max(0, graphJob?.windowsDone ?? 0)
  const pages = graphPageSpan(graphJob)
  const graphFailed = graphJob?.status === 'failed'
  const graphRunning = graphJob?.status === 'running'
  const graphExtractDone =
    graphFailed && (failedStep === 'align' || failedStep === 'node-embed')
      ? true
      : graphRunning && windowsTotal > 0 && windowsDone >= windowsTotal
  const laterBusy = embedBusy || graphOpen

  const extract: KnowledgeOrganizePhaseRow = extractBusy
    ? {
        id: 'extract',
        status: 'running',
        completed: ingest?.page ?? 0,
        total: ingest?.total ?? 0
      }
    : laterBusy || source.status === 'ready' || source.status === 'partial'
      ? { id: 'extract', status: 'done', completed: 0, total: 0 }
      : { id: 'extract', status: 'pending', completed: 0, total: 0 }

  const embed: KnowledgeOrganizePhaseRow = embedBusy
    ? {
        id: 'embed',
        status: 'running',
        completed: ingest?.page ?? 0,
        total: ingest?.total ?? 0
      }
    : extractBusy
      ? { id: 'embed', status: 'pending', completed: 0, total: 0 }
      : graphOpen || source.status === 'ready' || source.status === 'partial'
        ? { id: 'embed', status: 'done', completed: 0, total: 0 }
        : { id: 'embed', status: 'pending', completed: 0, total: 0 }

  const graph: KnowledgeOrganizePhaseRow = graphFailed
    ? graphExtractDone
      ? { id: 'graph', status: 'done', completed: 0, total: 0 }
      : { id: 'graph', status: 'failed', completed: 0, total: 0, error: graphError }
    : graphRunning && !graphExtractDone
      ? {
          id: 'graph',
          status: 'running',
          completed: pages ? pages.pageTo : windowsTotal > 0 ? windowsDone : 0,
          total: pages ? pages.pageTotal : windowsTotal > 0 ? windowsTotal : 0,
          pageFrom: pages?.pageFrom,
          pageTo: pages?.pageTo,
          pageTotal: pages?.pageTotal
        }
      : extractBusy || embedBusy || graphOpen
        ? { id: 'graph', status: graphExtractDone ? 'done' : 'pending', completed: 0, total: 0 }
        : { id: 'graph', status: 'pending', completed: 0, total: 0 }

  const graphNodes: KnowledgeOrganizePhaseRow =
    graphFailed && (failedStep === 'align' || failedStep === 'node-embed')
      ? { id: 'graphNodes', status: 'failed', completed: 0, total: 0, error: graphError }
      : graphFailed
        ? { id: 'graphNodes', status: 'pending', completed: 0, total: 0 }
        : graphRunning && graphExtractDone
          ? { id: 'graphNodes', status: 'running', completed: 0, total: 0 }
          : { id: 'graphNodes', status: 'pending', completed: 0, total: 0 }

  return {
    sourceId: source.id,
    title: source.title,
    phases: [extract, embed, graph, graphNodes],
    failed: graphFailed && !extractBusy && !embedBusy,
    error: graphFailed ? graphError : null
  }
}
