import type { KnowledgeRepository } from '@baishou/database/shared'
import type { ExtractEngineId } from './extract-engines'
import type { KnowledgeExtractOverride } from './knowledge-ingest.types'

/** 入队 OCR 时暂存的页码覆盖（consumer 无 payload 时用） */
const pendingExtractOverrides = new Map<string, KnowledgeExtractOverride>()

/** 用户点重新抽取图数据时，消费端另建 service 实例，用模块级标记跨实例传 force */
const pendingGraphExtractForce = new Set<string>()

/** 抽完正文 / 重试 / 整本重排：embed 完成后再排 graph，跨 consumer 实例传递 */
const pendingGraphFollowAfterEmbed = new Set<string>()

export const KNOWLEDGE_SOURCE_NOT_EMBEDDED_ERROR = 'source-not-embedded'

export function markGraphExtractForce(sourceId: string): void {
  const id = sourceId.trim()
  if (id) pendingGraphExtractForce.add(id)
}

export function peekGraphExtractForce(sourceId: string): boolean {
  return pendingGraphExtractForce.has(sourceId.trim())
}

export function clearGraphExtractForce(sourceId: string): void {
  pendingGraphExtractForce.delete(sourceId.trim())
}

export function markGraphFollowAfterEmbed(sourceId: string): void {
  const id = sourceId.trim()
  if (id) pendingGraphFollowAfterEmbed.add(id)
}

export function takeGraphFollowAfterEmbed(sourceId: string): boolean {
  const id = sourceId.trim()
  const hit = pendingGraphFollowAfterEmbed.has(id)
  pendingGraphFollowAfterEmbed.delete(id)
  return hit
}

export function clearGraphFollowAfterEmbed(sourceId: string): void {
  pendingGraphFollowAfterEmbed.delete(sourceId.trim())
}

export async function sourceHasChunkEmbeddings(
  repo: KnowledgeRepository,
  vaultId: string,
  sourceId: string
): Promise<boolean> {
  const ledger = await repo.getEmbedLedger(vaultId, sourceId)
  if (ledger?.status === 'embedded' && ledger.chunkCount > 0) return true
  return (await repo.countChunksBySource(sourceId)) > 0
}

/** 导入时指定提取完成后入队哪些后续任务；缺省两边都做 */
const pendingProcessTargets = new Map<string, { embed: boolean; graph: boolean }>()

export function rememberProcessTargets(
  sourceId: string,
  targets: { embed: boolean; graph: boolean }
): void {
  pendingProcessTargets.set(sourceId, targets)
}

export function takeProcessTargets(sourceId: string): { embed: boolean; graph: boolean } {
  const remembered = pendingProcessTargets.get(sourceId)
  pendingProcessTargets.delete(sourceId)
  return remembered ?? { embed: true, graph: true }
}

export function clearProcessTargets(sourceId: string): void {
  pendingProcessTargets.delete(sourceId)
}

/** 进行中的提取取消控制器 */
const extractAbortControllers = new Map<string, AbortController>()

/**
 * claim 之后、AbortController 注册之前的保护窗。
 * recoverStale 不得清掉这些 source，否则会与正在启动的 extract 竞态。
 */
const extractLiveGuards = new Set<string>()
const embedLiveGuards = new Set<string>()
const graphLiveGuards = new Set<string>()

/** consumer claim 到 extract job 后立刻调用；process 结束在 finally 中解除 */
export function markExtractJobLive(sourceId: string): void {
  extractLiveGuards.add(sourceId)
}

export function unmarkExtractJobLive(sourceId: string): void {
  extractLiveGuards.delete(sourceId)
}

export function markEmbedJobLive(sourceId: string): void {
  embedLiveGuards.add(sourceId)
}

export function unmarkEmbedJobLive(sourceId: string): void {
  embedLiveGuards.delete(sourceId)
}

export function markGraphJobLive(sourceId: string): void {
  graphLiveGuards.add(sourceId)
}

export function unmarkGraphJobLive(sourceId: string): void {
  graphLiveGuards.delete(sourceId)
}

export function listLiveGraphSourceIds(): string[] {
  return [...graphLiveGuards]
}

export function listLiveIngestSourceIds(): string[] {
  return [...embedLiveGuards, ...graphLiveGuards, ...extractLiveGuards]
}

export function takePendingExtractOverride(sourceId: string): KnowledgeExtractOverride | undefined {
  const queued = pendingExtractOverrides.get(sourceId)
  if (queued) pendingExtractOverrides.delete(sourceId)
  return queued
}

export function setPendingExtractOverride(
  sourceId: string,
  override: KnowledgeExtractOverride
): void {
  pendingExtractOverrides.set(sourceId, override)
}

export function beginExtractAbort(sourceId: string): AbortController {
  const abort = new AbortController()
  extractAbortControllers.set(sourceId, abort)
  return abort
}

export function isExtractProtected(sourceId: string): boolean {
  return (
    extractAbortControllers.has(sourceId) ||
    extractLiveGuards.has(sourceId) ||
    pendingExtractOverrides.has(sourceId)
  )
}

export function endExtractAbort(sourceId: string, controller?: AbortController): void {
  const cur = extractAbortControllers.get(sourceId)
  if (!controller || cur === controller) {
    extractAbortControllers.delete(sourceId)
  }
}

export function requestExtractAbort(sourceId: string): void {
  pendingExtractOverrides.delete(sourceId)
  const cur = extractAbortControllers.get(sourceId)
  if (cur) cur.abort()
}

export function isExtractCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('knowledge-extract-cancelled')
}

export function throwIfExtractAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('knowledge-extract-cancelled')
}

export function resolveStatusAfterCancel(source: {
  extractedTextHash?: string | null
  pageCount?: number | null
  textPageCount?: number | null
  extractEngine?: string | null
}): 'needs_ocr' | 'partial' | 'failed' {
  if (
    source.extractedTextHash &&
    source.pageCount != null &&
    source.textPageCount != null &&
    source.textPageCount > 0 &&
    source.textPageCount < source.pageCount
  ) {
    return 'partial'
  }
  if (source.extractedTextHash && (source.textPageCount ?? 0) > 0) {
    return 'partial'
  }
  const engine = source.extractEngine
  if (engine === 'ocr' || engine === 'vision') {
    return 'needs_ocr'
  }
  // 曾探测到页数但尚无文本：更像 OCR 欠账，而不是普通导入取消
  if (source.pageCount != null && source.pageCount > 0 && (source.textPageCount ?? 0) === 0) {
    return 'needs_ocr'
  }
  return 'failed'
}

export async function revertIfExtractAborted(
  repo: KnowledgeRepository,
  sourceId: string,
  signal?: AbortSignal
): Promise<void> {
  if (!signal?.aborted) return
  const latest = await repo.getSource(sourceId)
  if (latest) {
    const status = resolveStatusAfterCancel(latest)
    await repo.updateSourceStatus(sourceId, status, {
      errorMessage: status === 'failed' ? 'cancelled' : null
    })
  }
  await repo.deleteIngestJobsForSource(sourceId)
  throw new Error('knowledge-extract-cancelled')
}

export type { ExtractEngineId }
