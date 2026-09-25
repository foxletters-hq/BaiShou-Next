import { parseKnowledgeGraphStepError } from '@baishou/shared'
import {
  graphPageSpan,
  type NotebookGraphJobSnapshot
} from './notebook-graph-progress.util'
import {
  isKnowledgeGraphJobOpen,
  notebookOrganizeSourceRow,
  type KnowledgeGraphJobForSource,
  type KnowledgeOrganizeSourceRow
} from './notebook-organize-source.util'

export const KNOWLEDGE_ORGANIZE_PHASE_IDS = ['extract', 'embed', 'graph', 'graphNodes'] as const

export type KnowledgeOrganizePhaseId = (typeof KNOWLEDGE_ORGANIZE_PHASE_IDS)[number]

export type KnowledgeOrganizePhaseStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed'

export type KnowledgeIngestProgress = {
  page: number
  total: number
  phase?: string
}

export type KnowledgeOrganizeSource = {
  id: string
  title: string
  status: string
}

export type KnowledgeOrganizePhaseRow = {
  id: KnowledgeOrganizePhaseId
  status: KnowledgeOrganizePhaseStatus
  completed: number
  total: number
  pageFrom?: number
  pageTo?: number
  pageTotal?: number
  error?: string | null
}

export type KnowledgeOrganizeItem = {
  sourceId: string
  title: string
  phase: KnowledgeOrganizePhaseId | 'queued'
  completed: number
  total: number
  /** 独立线程正在做的步骤，只存在于这次进程的进度里 */
  activity?: string
}

export type KnowledgeOrganizeProgressCopy = {
  visible: boolean
  failed: boolean
  currentTitle: string | null
  error: string | null
  phases: KnowledgeOrganizePhaseRow[]
  items: KnowledgeOrganizeItem[]
  sourceRows: KnowledgeOrganizeSourceRow[]
}

const FINISHED_STATUSES = new Set(['ready', 'failed', 'partial', 'needs_ocr', 'stored'])

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

export function isKnowledgeOrganizeSource(
  source: KnowledgeOrganizeSource,
  progress?: KnowledgeIngestProgress,
  queuedSourceIds?: Iterable<string>,
  graphJobStatus?: string | null
): boolean {
  if (source.status === 'extracting' || source.status === 'embedding') return true
  if (progress && (progress.total > 0 || progress.page > 0 || progress.phase)) return true
  if (isKnowledgeGraphJobOpen(graphJobStatus)) return true
  if (queuedSourceIds && new Set(queuedSourceIds).has(source.id)) {
    return !FINISHED_STATUSES.has(source.status)
  }
  return false
}

function sourceItem(
  source: KnowledgeOrganizeSource,
  progress?: KnowledgeIngestProgress
): KnowledgeOrganizeItem {
  if (source.status === 'extracting' || isExtractPhase(progress?.phase)) {
    return {
      sourceId: source.id,
      title: source.title,
      phase: 'extract',
      completed: progress?.page ?? 0,
      total: progress?.total ?? 0,
      activity: progress?.phase
    }
  }
  if (source.status === 'embedding' || isEmbedPhase(progress?.phase)) {
    return {
      sourceId: source.id,
      title: source.title,
      phase: 'embed',
      completed: progress?.page ?? 0,
      total: progress?.total ?? 0
    }
  }
  return {
    sourceId: source.id,
    title: source.title,
    phase: 'queued',
    completed: 0,
    total: 0
  }
}

function sumProgress(
  items: KnowledgeOrganizeItem[],
  phase: KnowledgeOrganizePhaseId
): { completed: number; total: number } {
  return items
    .filter((item) => item.phase === phase)
    .reduce(
      (acc, item) => ({
        completed: acc.completed + item.completed,
        total: acc.total + item.total
      }),
      { completed: 0, total: 0 }
    )
}

/**
 * 只统计正在提取/嵌入的资料，以及用户点过的队列。
 * 笔记本里其他失败或卡住的 pending 不进入「整理 N 份」。
 */
export function notebookOrganizeProgressCopy(input: {
  sources: KnowledgeOrganizeSource[]
  ingestProgress?: Record<string, KnowledgeIngestProgress>
  queuedSourceIds?: Iterable<string>
  graph: NotebookGraphJobSnapshot
  graphJobsBySource?: Record<string, KnowledgeGraphJobForSource>
}): KnowledgeOrganizeProgressCopy {
  const progress = input.ingestProgress ?? {}
  const graphJobsBySource = input.graphJobsBySource ?? {}
  const organizingSources = input.sources.filter((source) =>
    isKnowledgeOrganizeSource(
      source,
      progress[source.id],
      input.queuedSourceIds,
      graphJobsBySource[source.id]?.status
    )
  )
  const items = organizingSources.map((source) => sourceItem(source, progress[source.id]))
  const sourceRows = organizingSources.map((source) =>
    notebookOrganizeSourceRow({
      source,
      ingestProgress: progress[source.id],
      graphJob: graphJobsBySource[source.id] ?? null
    })
  )

  const extractBusy = items.some((item) => item.phase === 'extract')
  const embedBusy = items.some((item) => item.phase === 'embed')
  const queuedBusy = items.some((item) => item.phase === 'queued')
  const graphRemaining = Math.max(0, input.graph.pending, input.graph.running)
  const graphWindows = Math.max(0, input.graph.windowsTotal ?? 0)
  const graphBusy = graphRemaining > 0 || graphWindows > 0 || input.graph.failed > 0
  const extractProgress = sumProgress(items, 'extract')
  const embedProgress = sumProgress(items, 'embed')

  const extract: KnowledgeOrganizePhaseRow = extractBusy
    ? {
        id: 'extract',
        status: 'running',
        completed: extractProgress.completed,
        total: extractProgress.total
      }
    : embedBusy || graphBusy
      ? { id: 'extract', status: 'done', completed: 0, total: 0 }
      : queuedBusy
        ? { id: 'extract', status: 'pending', completed: 0, total: 0 }
        : { id: 'extract', status: 'skipped', completed: 0, total: 0 }

  const embed: KnowledgeOrganizePhaseRow = embedBusy
    ? {
        id: 'embed',
        status: 'running',
        completed: embedProgress.completed,
        total: embedProgress.total
      }
    : extractBusy || queuedBusy
      ? { id: 'embed', status: 'pending', completed: 0, total: 0 }
      : graphBusy
        ? { id: 'embed', status: 'done', completed: 0, total: 0 }
        : { id: 'embed', status: 'skipped', completed: 0, total: 0 }

  const graphFailedOnly = input.graph.failed > 0 && graphRemaining <= 0
  const graphError = input.graph.lastError?.trim() || null
  const failedStep = parseKnowledgeGraphStepError(graphError)?.step ?? null
  const graphWindowsDone = Math.max(0, input.graph.windowsDone ?? 0)
  const graphPages = graphPageSpan(input.graph)
  const graphWindowsRunning = graphRemaining > 0 || graphWindows > 0
  const graphExtractDone =
    graphFailedOnly && (failedStep === 'align' || failedStep === 'node-embed')
      ? true
      : graphWindowsRunning && graphWindows > 0 && graphWindowsDone >= graphWindows
  const graph: KnowledgeOrganizePhaseRow = graphFailedOnly
    ? graphExtractDone
      ? { id: 'graph', status: 'done', completed: 0, total: 0 }
      : {
          id: 'graph',
          status: 'failed',
          completed: 0,
          total: 0,
          error: graphError
        }
    : graphWindowsRunning && !graphExtractDone
      ? {
          id: 'graph',
          status: 'running',
          completed: graphPages
            ? graphPages.pageTo
            : graphWindows > 0
              ? graphWindowsDone
              : 0,
          total: graphPages
            ? graphPages.pageTotal
            : graphWindows > 0
              ? graphWindows
              : graphRemaining,
          pageFrom: graphPages?.pageFrom,
          pageTo: graphPages?.pageTo,
          pageTotal: graphPages?.pageTotal
        }
      : extractBusy || embedBusy || queuedBusy || graphWindowsRunning || graphFailedOnly
        ? { id: 'graph', status: graphExtractDone ? 'done' : 'pending', completed: 0, total: 0 }
        : { id: 'graph', status: 'skipped', completed: 0, total: 0 }

  const graphNodesFailed = graphFailedOnly && (failedStep === 'align' || failedStep === 'node-embed')
  const graphNodes: KnowledgeOrganizePhaseRow = graphNodesFailed
    ? {
        id: 'graphNodes',
        status: 'failed',
        completed: 0,
        total: 0,
        error: graphError
      }
    : graphFailedOnly
      ? { id: 'graphNodes', status: 'pending', completed: 0, total: 0 }
      : graphWindowsRunning && graphExtractDone
        ? { id: 'graphNodes', status: 'running', completed: 0, total: 0 }
        : extractBusy || embedBusy || queuedBusy || graphWindowsRunning
          ? { id: 'graphNodes', status: 'pending', completed: 0, total: 0 }
          : { id: 'graphNodes', status: 'skipped', completed: 0, total: 0 }

  const currentTitle =
    items.find((item) => item.phase === 'extract' || item.phase === 'embed')?.title ||
    input.graph.currentSourceTitle?.trim() ||
    input.graph.failedSourceTitle?.trim() ||
    items[0]?.title ||
    null

  return {
    visible: items.length > 0 || graphBusy,
    failed: graphFailedOnly && !extractBusy && !embedBusy && !queuedBusy,
    currentTitle,
    error: graphFailedOnly ? graphError : null,
    phases: [extract, embed, graph, graphNodes],
    items,
    sourceRows
  }
}

/** 顶栏收起按钮跟当前阶段对齐，避免资料已就绪时还只写「正在整理」。 */
export function knowledgeOrganizeCompactKind(
  phases: KnowledgeOrganizePhaseRow[],
  failed: boolean
): KnowledgeOrganizePhaseId | 'failed' | 'generic' {
  if (failed) return 'failed'
  return phases.find((row) => row.status === 'running')?.id ?? 'generic'
}

