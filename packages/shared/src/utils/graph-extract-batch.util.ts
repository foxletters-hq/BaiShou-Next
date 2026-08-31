import { buildDiaryEmbeddingSourceId } from './rag-diary.util'
import { normalizeGraphFilePath, normalizeGraphName } from './graph-identity.util'

/** 图谱抽取 LLM 并发：用户可选，默认 5，上限 10。 */
export const GRAPH_EXTRACT_CONCURRENCY_MIN = 1
export const GRAPH_EXTRACT_CONCURRENCY_MAX = 10
export const GRAPH_EXTRACT_CONCURRENCY_DEFAULT = 5

/** 攒满这么多篇草稿（或本批抽完）再做一次模型对齐并落盘。 */
export const GRAPH_EXTRACT_ALIGN_POOL_SIZE = 10

export const GRAPH_EXTRACT_CONCURRENCY_STORAGE_KEY = 'baishou.graph.extractConcurrency.v1'

export const GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR = 'GRAPH_EXTRACT_EMBEDDING_REQUIRED'
export const GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR = 'GRAPH_EXTRACT_DIARY_NOT_EMBEDDED'
export const GRAPH_EXTRACT_EMPTY_RESPONSE_ERROR = 'GRAPH_EXTRACT_EMPTY_RESPONSE'
export const GRAPH_EXTRACT_PARSE_JSON_ERROR = 'GRAPH_EXTRACT_PARSE_JSON'

export function resolveGraphExtractConcurrency(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return GRAPH_EXTRACT_CONCURRENCY_DEFAULT
  return Math.min(
    GRAPH_EXTRACT_CONCURRENCY_MAX,
    Math.max(GRAPH_EXTRACT_CONCURRENCY_MIN, Math.round(n))
  )
}

export function graphCosineDistanceToSimilarity(distance: number): number {
  if (!Number.isFinite(distance)) return 0
  return Math.min(1, Math.max(0, 1 - distance))
}

export async function buildGraphExtractEnqueueItems(opts: {
  wanted: string[]
  pending: Array<{ filePath: string; date?: string }>
  isDiaryEmbedded?: (filePath: string) => boolean | Promise<boolean>
}): Promise<{ items: Array<{ filePath: string; date?: string }>; skippedNotEmbedded: string[] }> {
  const byPath = new Map<string, { filePath: string; date?: string }>()
  for (const row of opts.pending) {
    const key = normalizeGraphFilePath(row.filePath)
    if (key) byPath.set(key, row)
  }
  const skippedNotEmbedded: string[] = []
  const items: Array<{ filePath: string; date?: string }> = []
  for (const raw of opts.wanted) {
    const filePath = normalizeGraphFilePath(raw)
    if (!filePath) continue
    if (opts.isDiaryEmbedded && !(await opts.isDiaryEmbedded(filePath))) {
      skippedNotEmbedded.push(filePath)
      continue
    }
    const hit = byPath.get(filePath)
    items.push({ filePath, date: hit?.date })
  }
  return { items, skippedNotEmbedded }
}

export function entityAlignKey(nodeType: string, name: string): string {
  const t = nodeType.trim().toLowerCase() || 'topic'
  return `${t}\0${normalizeGraphName(name)}`
}

export function isGraphExtractBusyStatus(status: string | undefined): boolean {
  return status === 'pending' || status === 'running' || status === 'aligning'
}

export type GraphExtractQueuePhase =
  | 'queued'
  | 'reading'
  | 'model'
  | 'waiting_model'
  | 'thinking'
  | 'streaming'
  | 'parsing'
  | 'waiting_pool'
  | 'recalling'
  | 'waiting_align'
  | 'aligning'
  | 'writing'

const GRAPH_EXTRACT_PHASE_PROGRESS: Record<GraphExtractQueuePhase, number> = {
  queued: 0,
  reading: 12,
  model: 40,
  waiting_model: 40,
  thinking: 40,
  streaming: 40,
  parsing: 55,
  waiting_pool: 70,
  recalling: 78,
  waiting_align: 85,
  aligning: 90,
  writing: 96
}

export function graphExtractPhaseProgress(phase?: GraphExtractQueuePhase): number {
  if (!phase) return 0
  return GRAPH_EXTRACT_PHASE_PROGRESS[phase] ?? 0
}

export type GraphExtractPhaseCopy = {
  key: string
  defaultValue: string
  params?: Record<string, string | number>
}

export function graphExtractItemProgress(item: {
  status?: string
  progress?: number
}): number {
  if (item.status === 'completed' || item.status === 'error') return 100
  if (item.status === 'pending') return 0
  const n = Math.round(Number(item.progress) || 0)
  return Math.max(0, Math.min(100, n))
}

export function graphExtractBarPercent(item: {
  status?: string
  progress?: number
  phase?: GraphExtractQueuePhase
}): number {
  if (item.status === 'completed' || item.status === 'error') return 100
  if (item.status === 'pending' || item.phase === 'queued') return 0
  if (item.phase) return graphExtractPhaseProgress(item.phase)
  if (item.status === 'running') return graphExtractPhaseProgress('model')
  if (item.status === 'aligning') return graphExtractPhaseProgress('waiting_pool')
  return graphExtractItemProgress(item)
}

export function graphExtractOverallProgress(
  items: Array<{ status?: string; progress?: number; phase?: GraphExtractQueuePhase }>
): number {
  if (!items.length) return 0
  const sum = items.reduce((total, item) => total + graphExtractBarPercent(item), 0)
  return Math.round(sum / items.length)
}

export function describeGraphExtractPhase(item: {
  status?: string
  phase?: GraphExtractQueuePhase
  phaseDetail?: string
}): GraphExtractPhaseCopy {
  const phase =
    item.phase ??
    (item.status === 'pending'
      ? 'queued'
      : item.status === 'running'
        ? 'model'
        : item.status === 'aligning'
          ? 'waiting_pool'
          : undefined)
  switch (phase) {
    case 'queued':
      return { key: 'graph.queue_phase_queued', defaultValue: '排队中' }
    case 'reading':
      return { key: 'graph.queue_phase_reading', defaultValue: '读取日记' }
    case 'model':
    case 'waiting_model':
    case 'thinking':
    case 'streaming':
      return { key: 'graph.queue_phase_model', defaultValue: '模型处理中' }
    case 'parsing':
      return { key: 'graph.queue_phase_parsing', defaultValue: '解析抽取结果' }
    case 'waiting_pool':
      return {
        key: 'graph.queue_phase_waiting_pool',
        defaultValue: '等候候选池批量处理（{{detail}}）',
        params: { detail: item.phaseDetail || `0/${GRAPH_EXTRACT_ALIGN_POOL_SIZE}` }
      }
    case 'recalling':
      return { key: 'graph.queue_phase_recalling', defaultValue: '召回相似候选' }
    case 'waiting_align':
      return { key: 'graph.queue_phase_waiting_align', defaultValue: '等候模型判断是否合并' }
    case 'aligning':
      return { key: 'graph.queue_phase_aligning', defaultValue: '模型判断是否合并' }
    case 'writing':
      return { key: 'graph.queue_phase_writing', defaultValue: '写入图谱' }
    default:
      if (item.status === 'completed') {
        return { key: 'graph.queue_done', defaultValue: '已完成' }
      }
      if (item.status === 'error') {
        return { key: 'graph.queue_error', defaultValue: '失败' }
      }
      return { key: 'graph.queue_pending', defaultValue: '排队中' }
  }
}

export function describeGraphExtractQueueError(error?: string): GraphExtractPhaseCopy {
  const raw = String(error || '').trim()
  switch (raw) {
    case GRAPH_EXTRACT_EMPTY_RESPONSE_ERROR:
    case 'LLM returned empty response':
      return { key: 'graph.extract_empty_response', defaultValue: '模型没有返回正文' }
    case GRAPH_EXTRACT_PARSE_JSON_ERROR:
    case 'Failed to parse LLM JSON':
      return {
        key: 'graph.extract_parse_failed',
        defaultValue: '模型返回的内容无法解析为抽取结果'
      }
    case GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR:
      return {
        key: 'graph.extract_embedding_required',
        defaultValue: '请先配置嵌入模型，并完成本篇日记的向量化后再抽取'
      }
    case GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR:
      return {
        key: 'graph.extract_diary_not_embedded',
        defaultValue: '这篇日记还没有向量，请先嵌入后再抽取'
      }
    default:
      return {
        key: 'graph.queue_error_message',
        defaultValue: raw || '失败',
        params: { message: raw || '失败' }
      }
  }
}

export function isDiaryEmbeddingPresent(
  vaultId: string,
  diaryId: string | number,
  embeddedSourceIds: Set<string>
): boolean {
  if (embeddedSourceIds.has(buildDiaryEmbeddingSourceId(vaultId, diaryId))) return true
  return embeddedSourceIds.has(String(diaryId))
}

export function resolveDiaryIdByFilePath(
  filePath: string,
  records: Array<{ id: number | string; filePath: string }>
): string | null {
  const key = normalizeGraphFilePath(filePath)
  if (!key) return null
  const hit = records.find((row) => normalizeGraphFilePath(row.filePath) === key)
  return hit ? String(hit.id) : null
}

export function isDiaryFileEmbedded(opts: {
  vaultId: string
  filePath: string
  diaryIdByPath: Map<string, string>
  embeddedSourceIds: Set<string>
}): boolean {
  const diaryId =
    opts.diaryIdByPath.get(normalizeGraphFilePath(opts.filePath)) ??
    resolveDiaryIdByFilePath(opts.filePath, [])
  if (!diaryId) return false
  return isDiaryEmbeddingPresent(opts.vaultId, diaryId, opts.embeddedSourceIds)
}

export function loadGraphExtractConcurrency(): number {
  try {
    if (typeof localStorage === 'undefined') return GRAPH_EXTRACT_CONCURRENCY_DEFAULT
    return resolveGraphExtractConcurrency(localStorage.getItem(GRAPH_EXTRACT_CONCURRENCY_STORAGE_KEY))
  } catch {
    return GRAPH_EXTRACT_CONCURRENCY_DEFAULT
  }
}

export function saveGraphExtractConcurrency(value: unknown): number {
  const n = resolveGraphExtractConcurrency(value)
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GRAPH_EXTRACT_CONCURRENCY_STORAGE_KEY, String(n))
    }
  } catch {
    // ignore
  }
  return n
}
