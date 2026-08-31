import { streamText } from 'ai'
import { GRAPH_EDGE_TYPES, GRAPH_NODE_TYPES, type GraphExtractStore } from '@baishou/database/shared'
import type { IAIProvider } from '@baishou/ai'
import { wrapLanguageModelWithMiddlewares } from '@baishou/ai'
import {
  logger,
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  GRAPH_EXTRACT_ALIGN_POOL_SIZE,
  GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR,
  GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR,
  GRAPH_EXTRACT_EMPTY_RESPONSE_ERROR,
  GRAPH_EXTRACT_PARSE_JSON_ERROR,
  entryNodeIdForFilePath,
  entityAlignKey,
  graphDiaryInstant,
  graphEdgeId,
  graphNodeIdForEntity,
  legacyEntryNodeIdForFilePath,
  graphReviewStatusFromConfidence,
  normalizeGraphExtractConfidence,
  normalizeGraphName,
  normalizeGraphFilePath,
  preferGraphOrigin,
  graphExtractPhaseProgress,
  type GraphExtractQueuePhase,
  type GraphExtractQueueProgressUpdate
} from '@baishou/shared'
import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { md5Hex } from '../fs/md5'
import type { IStoragePathService } from '../vault/storage-path.types'
import type { DerivedFreshnessService } from '../raw-data/derived-freshness.service'
import type { GraphEdgeRawRecord, GraphNodeRawRecord } from '../raw-data/raw-data-source.types'
import type { GraphPendingIndexSync } from '../raw-data/graph-sync.service'
import type { GraphExtractRawWriter } from '../raw-data/graph-extract-raw'
import {
  findOrCreateGraphNode,
  resolveGraphEndpointId
} from './find-or-create-graph-node'
import {
  alignEntityPool,
  buildEntityAlignPrompt,
  parseEntityAlignDecisions
} from './graph-entity-align'

const NODE_TYPE_SET = new Set<string>(GRAPH_NODE_TYPES)
const EDGE_TYPE_SET = new Set<string>(GRAPH_EDGE_TYPES)

function graphExtractAbortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError')
}

function throwIfGraphExtractAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw graphExtractAbortError()
}

async function awaitAbortableText(
  textPromise: Promise<string>,
  signal?: AbortSignal
): Promise<string> {
  throwIfGraphExtractAborted(signal)
  if (!signal) return textPromise
  return new Promise<string>((resolve, reject) => {
    const onAbort = () => reject(graphExtractAbortError())
    signal.addEventListener('abort', onAbort, { once: true })
    textPromise.then(
      (text) => {
        signal.removeEventListener('abort', onAbort)
        if (signal.aborted) {
          reject(graphExtractAbortError())
          return
        }
        resolve(text)
      },
      (err) => {
        signal.removeEventListener('abort', onAbort)
        reject(err)
      }
    )
  })
}

type GraphExtractStreamPart = {
  type?: string
  text?: unknown
  textDelta?: unknown
  delta?: unknown
}

type GraphExtractStreamReaderSource = {
  getReader: () => {
    read: () => Promise<{ done: boolean; value?: unknown }>
    releaseLock: () => void
  }
}

function asGraphExtractTextChunk(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof (value as { text?: unknown }).text === 'string') {
    return (value as { text: string }).text
  }
  return ''
}

function readGraphExtractPartText(part: GraphExtractStreamPart): string {
  return (
    asGraphExtractTextChunk(part.textDelta) ||
    asGraphExtractTextChunk(part.text) ||
    asGraphExtractTextChunk(part.delta) ||
    ''
  )
}

function isGraphExtractTextPart(part: GraphExtractStreamPart): boolean {
  return part.type === 'text-delta' || part.type === 'text'
}

function isGraphExtractReasoningPart(part: GraphExtractStreamPart): boolean {
  return part.type === 'reasoning-delta' || part.type === 'reasoning'
}

function isNoOutputGeneratedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if ((error as { [key: symbol]: unknown })[Symbol.for('vercel.ai.error.AI_NoOutputGeneratedError')] === true) {
    return true
  }
  const name = 'name' in error ? String(error.name) : ''
  const message = 'message' in error ? String(error.message) : ''
  return name === 'AI_NoOutputGeneratedError' || message.includes('NoOutputGenerated')
}

function isAsyncIterableStream(value: unknown): value is AsyncIterable<unknown> {
  return Boolean(value && typeof value === 'object' && Symbol.asyncIterator in value)
}

function isStreamReaderSource(value: unknown): value is GraphExtractStreamReaderSource {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as GraphExtractStreamReaderSource).getReader === 'function'
  )
}

function canIterateGraphExtractStream(stream: unknown): boolean {
  return isAsyncIterableStream(stream) || isStreamReaderSource(stream)
}

async function* iterateGraphExtractStream(stream: unknown): AsyncGenerator<unknown> {
  if (isAsyncIterableStream(stream)) {
    yield* stream
    return
  }
  if (!isStreamReaderSource(stream)) return
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

export async function collectGraphExtractStreamText(opts: {
  fullStream?: unknown
  textStream?: AsyncIterable<string>
  textPromise?: Promise<string>
  signal?: AbortSignal
  onDelta?: (chars: number) => void
  onReasoning?: (chars: number) => void
}): Promise<string> {
  throwIfGraphExtractAborted(opts.signal)
  if (opts.fullStream && canIterateGraphExtractStream(opts.fullStream)) {
    const consume = (async () => {
      let text = ''
      let reasoning = ''
      for await (const value of iterateGraphExtractStream(opts.fullStream)) {
        throwIfGraphExtractAborted(opts.signal)
        const part = (value ?? {}) as GraphExtractStreamPart
        if (part.type === 'error') {
          const err = (value as { error?: unknown } | null)?.error
          throw err instanceof Error ? err : new Error(String(err ?? 'Graph extract stream error'))
        }
        if (part.type === 'abort') {
          throw graphExtractAbortError()
        }
        const piece = readGraphExtractPartText(part)
        if (!piece) continue
        if (isGraphExtractReasoningPart(part)) {
          reasoning += piece
          opts.onReasoning?.(reasoning.length)
          continue
        }
        if (!isGraphExtractTextPart(part) && part.type) continue
        text += piece
        opts.onDelta?.(text.length)
      }
      return text
    })()
    void consume.catch(() => undefined)
    return awaitAbortableText(consume, opts.signal)
  }
  if (opts.textStream) {
    const consume = (async () => {
      let text = ''
      for await (const chunk of opts.textStream!) {
        throwIfGraphExtractAborted(opts.signal)
        const piece =
          typeof chunk === 'string' ? chunk : readGraphExtractPartText((chunk ?? {}) as GraphExtractStreamPart)
        if (!piece) continue
        text += piece
        opts.onDelta?.(text.length)
      }
      return text
    })()
    void consume.catch(() => undefined)
    return awaitAbortableText(consume, opts.signal)
  }
  if (!opts.textPromise) return ''
  const text = await awaitAbortableText(opts.textPromise, opts.signal)
  if (text) opts.onDelta?.(text.length)
  return text
}

export async function resolveGraphExtractLlmText(opts: {
  fullStream?: unknown
  textStream?: AsyncIterable<string>
  textPromise?: Promise<string>
  signal?: AbortSignal
  onDelta?: (chars: number) => void
  onReasoning?: (chars: number) => void
}): Promise<string> {
  throwIfGraphExtractAborted(opts.signal)
  let streamed = ''
  let streamError: unknown
  try {
    streamed = await collectGraphExtractStreamText({
      fullStream: opts.fullStream,
      textStream: canIterateGraphExtractStream(opts.fullStream) ? undefined : opts.textStream,
      signal: opts.signal,
      onDelta: opts.onDelta,
      onReasoning: opts.onReasoning
    })
  } catch (error) {
    if (opts.signal?.aborted || (error as { name?: string }).name === 'AbortError') throw error
    streamError = error
    logger.warn('[GraphExtract] LLM stream failed:', error as Error)
  }

  const trimmed = streamed.trim()
  if (trimmed) return trimmed

  if (opts.textPromise) {
    try {
      const fallback = await awaitAbortableText(opts.textPromise, opts.signal)
      const fallbackTrimmed = fallback?.trim() || ''
      if (fallbackTrimmed) {
        opts.onDelta?.(fallbackTrimmed.length)
        return fallbackTrimmed
      }
    } catch (error) {
      if (opts.signal?.aborted || (error as { name?: string }).name === 'AbortError') throw error
      if (isNoOutputGeneratedError(error)) return ''
      logger.warn('[GraphExtract] LLM call failed:', error as Error)
      throw error
    }
  }

  if (streamError) throw streamError
  return ''
}

export interface GraphExtractLlmDeps {
  provider: IAIProvider
  modelId: string
}

export type GraphExtractLlmFn = (prompt: {
  system: string
  user: string
  signal?: AbortSignal
  onDelta?: (chars: number) => void
  onReasoning?: (chars: number) => void
}) => Promise<string | null>

export interface ExtractDiariesOptions {
  /** 稳定仓库身份（GraphRepository 键） */
  vaultId: string
  /** 写入 JSONL 的显示名快照 */
  vaultName: string
  /**
   * 日记第一人称/作者自称（须已由用户确认；空则拒绝抽取）。
   * 禁止使用「日记的主人」等占位称呼。
   */
  selfName: string
  /** Empty = all pending-reextract */
  filePaths?: string[]
  onProgress?: (p: { current: number; total: number; filePath: string }) => void
  /** Cancel mid-batch: abort in-flight model streams; already-written diaries stay committed. */
  signal?: AbortSignal
}

export interface ExtractDiariesResult {
  done: number
  failed: number
  cancelled?: boolean
  errors: Array<{ filePath: string; message: string }>
}

export type GraphExtractAlignDeps = {
  embedQuery?: (text: string) => Promise<number[] | null>
  modelId?: string
  isEmbeddingConfigured?: () => boolean | Promise<boolean>
  isDiaryEmbedded?: (filePath: string) => boolean | Promise<boolean>
}

export type GraphExtractDraftEntity = {
  name: string
  type: string
  aliases: string[]
  summary: string
  confidence: number
}

export type GraphExtractDraftEdge = {
  from: string
  to: string
  type: string
  excerpt: string
  confidence: number
}

export type GraphExtractDraft = {
  vaultId: string
  vaultName: string
  filePath: string
  contentHash: string
  hash: string
  dateStr: string | null
  shardMonth: string
  validFrom: number
  entities: GraphExtractDraftEntity[]
  edges: GraphExtractDraftEdge[]
}

/** Conservative (overestimate) time for first-run graph extraction guide. */
export interface ExtractionCostEstimate {
  entryCount: number
  estimatedTokens: number
  estimatedMinutesLow: number
  estimatedMinutesHigh: number
}

/** Floor tokens/entry when char length unknown. */
const ESTIMATE_TOKENS_FLOOR = 600
/** Upper-bound multiplier so UI prefers overestimate. */
const ESTIMATE_OVERESTIMATE = 1.25
const ESTIMATE_SECONDS_PER_ENTRY_LOW = 2
const ESTIMATE_SECONDS_PER_ENTRY_HIGH = 4

/** Per-diary token estimate from character count (prefer overestimate). */
export function estimateTokensForDiaryChars(chars: number): number {
  const n = Math.max(0, Math.floor(chars))
  return Math.max(ESTIMATE_TOKENS_FLOOR, Math.ceil(n / 2))
}

/**
 * Estimate LLM time for extracting diaries.
 * Prefer passing `charCounts` (per pending file); without them falls back to floor × entryCount.
 */
export function estimateExtractionCost(
  entryCount: number,
  opts?: { charCounts?: number[] }
): ExtractionCostEstimate {
  const n = Math.max(0, Math.floor(entryCount))
  const counts = opts?.charCounts
  let rawTokens = 0
  if (counts && counts.length > 0) {
    const limited = counts.slice(0, n || counts.length)
    for (const c of limited) rawTokens += estimateTokensForDiaryChars(c)
    // If entryCount > provided counts, pad with floor
    if (n > limited.length) {
      rawTokens += (n - limited.length) * ESTIMATE_TOKENS_FLOOR
    }
  } else {
    rawTokens = n * ESTIMATE_TOKENS_FLOOR
  }
  const estimatedTokens = Math.ceil(rawTokens * ESTIMATE_OVERESTIMATE)
  return {
    entryCount: n,
    estimatedTokens,
    estimatedMinutesLow:
      n === 0 ? 0 : Math.max(1, Math.ceil((n * ESTIMATE_SECONDS_PER_ENTRY_LOW) / 60)),
    estimatedMinutesHigh:
      n === 0 ? 0 : Math.max(1, Math.ceil((n * ESTIMATE_SECONDS_PER_ENTRY_HIGH) / 60))
  }
}

interface LlmEntity {
  name: string
  type: string
  aliases?: string[]
  summary?: string
  confidence?: number
}

interface LlmEdge {
  from: string
  to: string
  type: string
  excerpt?: string
  confidence?: number
}

interface LlmExtractPayload {
  entities: LlmEntity[]
  edges: LlmEdge[]
}

function normalizeFilePath(filePath: string): string {
  return normalizeGraphFilePath(filePath)
}

export { entryNodeIdForFilePath, legacyEntryNodeIdForFilePath }

function clampNodeType(raw: string): string {
  const t = raw.trim().toLowerCase()
  return NODE_TYPE_SET.has(t) ? t : 'topic'
}

function clampEdgeType(raw: string): string {
  const t = raw.trim().toLowerCase()
  return EDGE_TYPE_SET.has(t) ? t : 'relates_to'
}

/** Extract the first balanced JSON object from LLM text (handles markdown fences). */
export function extractFirstJsonObject(text: string): string | null {
  const stripped = text
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .trim()
  const start = stripped.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i]!
    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return stripped.slice(start, i + 1)
    }
  }
  return null
}

function parseJsonObject(raw?: string | null): Record<string, unknown> {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function parseExtractJson(text: string): LlmExtractPayload | null {
  const json = extractFirstJsonObject(text)
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as Partial<LlmExtractPayload>
    return {
      entities: Array.isArray(parsed.entities) ? (parsed.entities as LlmEntity[]) : [],
      edges: Array.isArray(parsed.edges) ? (parsed.edges as LlmEdge[]) : []
    }
  } catch {
    return null
  }
}

function isPathInsideVault(vaultRoot: string, absolutePath: string): boolean {
  const root = path.resolve(vaultRoot).replace(/\\/g, '/').replace(/\/+$/, '')
  const abs = path.resolve(absolutePath).replace(/\\/g, '/')
  const rootLower = root.toLowerCase()
  const absLower = abs.toLowerCase()
  return absLower === rootLower || absLower.startsWith(`${rootLower}/`)
}

export function buildExtractPrompt(
  diaryText: string,
  dateStr: string | null,
  selfName: string
): {
  system: string
  user: string
} {
  const nodeTypes = GRAPH_NODE_TYPES.join(', ')
  const edgeTypes = GRAPH_EDGE_TYPES.join(', ')
  const author = selfName.trim()
  return {
    system: '你是日记关系图谱抽取器。只输出严格 JSON，不要 markdown 代码块，不要额外解释。',
    user: `从以下日记中抽取实体与关系。

## 约束
1. node type 只能是: ${nodeTypes}
2. edge type 只能是: ${edgeTypes}
3. 不要编造日记未出现的事实；不确定的实体/边给较低 confidence（0-100）
4. 实体 name 用日记中的称呼；可填 aliases
5. edges.from / edges.to 使用实体 name（或 entry 锚点名）
6. 每篇日记都有一个结构性锚点 entry（name 用日期或「日记」），实体应尽量连到 entry（mentions / participates_in / evokes 等）
7. 日记中的第一人称「我」以及作者本人，统一使用自称「${author}」作为 person 实体名；禁止使用「日记的主人」「作者」「用户」等占位称呼

## 日记日期
${dateStr || '未知'}

## 日记正文
${diaryText.slice(0, 12000)}

## 输出格式（严格 JSON）
{"entities":[{"name":"","type":"person","aliases":[],"summary":"","confidence":80}],"edges":[{"from":"","to":"","type":"mentions","excerpt":"","confidence":80}]}`
  }
}

export function createDefaultGraphExtractLlm(deps: GraphExtractLlmDeps): GraphExtractLlmFn {
  return async ({ system, user, signal, onDelta, onReasoning }) => {
    throwIfGraphExtractAborted(signal)
    const baseModel = deps.provider.getLanguageModel(deps.modelId)
    const model = wrapLanguageModelWithMiddlewares(baseModel, {
      providerType: deps.provider.config?.type || 'openai',
      providerId: deps.provider.config?.id,
      modelId: deps.modelId
    })
    const streamResult = streamText({
      model,
      system,
      messages: [{ role: 'user', content: user }],
      temperature: 0.1,
      abortSignal: signal
    })
    const textPromise = Promise.resolve(streamResult.text)
    void textPromise.catch(() => undefined)
    void Promise.resolve(streamResult.usage).catch(() => undefined)
    void Promise.resolve(streamResult.response).catch(() => undefined)
    const text = await resolveGraphExtractLlmText({
      fullStream: streamResult.fullStream,
      textStream: streamResult.textStream,
      textPromise,
      signal,
      onDelta,
      onReasoning
    })
    return text?.trim() || null
  }
}

/**
 * Manual diary → graph LLM extraction (management UI + diary-side entry points).
 * LLM produces drafts; a second LLM pass aligns entities, then JSONL write happens in commitDrafts (pool of 10).
 */
export class GraphLlmExtractionService {
  constructor(
    private readonly graphManager: GraphExtractRawWriter,
    private readonly freshness: DerivedFreshnessService,
    private readonly repo: GraphExtractStore,
    private readonly graphSync: GraphPendingIndexSync,
    private readonly pathService: IStoragePathService,
    private readonly fs: IFileSystem,
    private readonly llm: GraphExtractLlmFn,
    private readonly alignDeps?: GraphExtractAlignDeps | null
  ) {}

  async extractDiaries(opts: ExtractDiariesOptions): Promise<ExtractDiariesResult> {
    const selfName = opts.selfName?.trim()
    if (!selfName) {
      throw new Error(GRAPH_SELF_NAME_REQUIRED_ERROR)
    }
    await this.assertEmbeddingConfigured()

    const pending = await this.freshness.listPendingReextract()
    const wanted = new Set((opts.filePaths ?? []).map(normalizeFilePath).filter(Boolean))
    const targets =
      wanted.size === 0 ? pending : pending.filter((p) => wanted.has(normalizeFilePath(p.filePath)))

    if (wanted.size > 0 && targets.length === 0) {
      return {
        done: 0,
        failed: wanted.size,
        errors: [...wanted].map((filePath) => ({
          filePath,
          message: 'Not in pending-reextract list'
        }))
      }
    }

    let done = 0
    let failed = 0
    let cancelled = false
    const errors: Array<{ filePath: string; message: string }> = []
    const pool: GraphExtractDraft[] = []

    const flushPool = async () => {
      if (pool.length === 0) return
      const batch = pool.splice(0, pool.length)
      try {
        const results = await this.commitDrafts(batch, opts.signal)
        for (const result of results) {
          if (result.error) {
            failed += 1
            errors.push({ filePath: result.filePath, message: result.error })
          } else {
            done += 1
          }
        }
      } catch (e) {
        if (opts.signal?.aborted) {
          cancelled = true
          return
        }
        const message = e instanceof Error ? e.message : String(e)
        for (const draft of batch) {
          failed += 1
          errors.push({ filePath: draft.filePath, message })
        }
      }
    }

    for (let i = 0; i < targets.length; i++) {
      if (opts.signal?.aborted) {
        cancelled = true
        break
      }
      const target = targets[i]!
      opts.onProgress?.({
        current: i + 1,
        total: targets.length,
        filePath: target.filePath
      })
      try {
        const draft = await this.extractDraft({
          vaultId: opts.vaultId,
          vaultName: opts.vaultName,
          filePath: target.filePath,
          contentHash: target.contentHash,
          selfName,
          signal: opts.signal
        })
        pool.push(draft)
        if (pool.length >= GRAPH_EXTRACT_ALIGN_POOL_SIZE) {
          await flushPool()
        }
      } catch (e) {
        if (opts.signal?.aborted) {
          cancelled = true
          break
        }
        failed += 1
        const message = e instanceof Error ? e.message : String(e)
        errors.push({ filePath: target.filePath, message })
        logger.warn(`[GraphExtract] failed ${target.filePath}:`, e as Error)
      }
    }

    if (!cancelled) {
      await flushPool()
    }

    return { done, failed, cancelled: cancelled || undefined, errors }
  }

  async extractDraft(opts: {
    vaultId: string
    vaultName: string
    filePath: string
    contentHash?: string
    selfName: string
    signal?: AbortSignal
    onProgress?: (update: GraphExtractQueueProgressUpdate) => void
  }): Promise<GraphExtractDraft> {
    const selfName = opts.selfName?.trim()
    if (!selfName) {
      throw new Error(GRAPH_SELF_NAME_REQUIRED_ERROR)
    }
    throwIfGraphExtractAborted(opts.signal)
    opts.onProgress?.({ phase: 'reading', progress: graphExtractPhaseProgress('reading') })
    await this.assertEmbeddingConfigured()
    await this.assertDiaryEmbedded(opts.filePath)

    const abs = await this.resolveAbsolutePath(opts.filePath)
    const raw = await this.fs.readFile(abs, 'utf8')
    throwIfGraphExtractAborted(opts.signal)
    opts.onProgress?.({ phase: 'model', progress: graphExtractPhaseProgress('model') })
    const actualHash = md5Hex(raw)
    const hash = actualHash || opts.contentHash || ''
    const diaryInstant = graphDiaryInstant(opts.filePath)
    const dateStr = diaryInstant.dateStr
    const prompt = buildExtractPrompt(raw, dateStr, selfName)
    const text = await this.llm({
      ...prompt,
      signal: opts.signal
    })
    throwIfGraphExtractAborted(opts.signal)
    opts.onProgress?.({ phase: 'parsing', progress: graphExtractPhaseProgress('parsing') })
    if (!text) {
      throw new Error(GRAPH_EXTRACT_EMPTY_RESPONSE_ERROR)
    }
    const payload = parseExtractJson(text)
    if (!payload) {
      throw new Error(GRAPH_EXTRACT_PARSE_JSON_ERROR)
    }

    const now = Date.now()
    const entities: GraphExtractDraftEntity[] = []
    for (const ent of payload.entities) {
      const name = String(ent.name || '').trim()
      if (!name) continue
      const nodeType = clampNodeType(String(ent.type || 'topic'))
      if (nodeType === 'entry') continue
      const confidence = normalizeGraphExtractConfidence(ent.confidence, 80)
      entities.push({
        name,
        type: nodeType,
        aliases: Array.isArray(ent.aliases)
          ? ent.aliases.filter((a): a is string => typeof a === 'string')
          : [],
        summary: typeof ent.summary === 'string' ? ent.summary : '',
        confidence
      })
    }

    const edges: GraphExtractDraftEdge[] = []
    for (const edge of payload.edges) {
      const from = String(edge.from || '').trim()
      const to = String(edge.to || '').trim()
      if (!from || !to) continue
      const confidence = normalizeGraphExtractConfidence(edge.confidence, 75)
      edges.push({
        from,
        to,
        type: clampEdgeType(String(edge.type || 'relates_to')),
        excerpt: typeof edge.excerpt === 'string' ? edge.excerpt : '',
        confidence
      })
    }

    return {
      vaultId: opts.vaultId,
      vaultName: opts.vaultName,
      filePath: normalizeFilePath(opts.filePath),
      contentHash: opts.contentHash || hash,
      hash,
      dateStr,
      shardMonth: diaryInstant.shardMonth,
      validFrom: diaryInstant.validFrom ?? now,
      entities,
      edges
    }
  }

  async commitDrafts(
    drafts: GraphExtractDraft[],
    signal?: AbortSignal,
    onPhase?: (phase: GraphExtractQueuePhase, detail?: string) => void
  ): Promise<Array<{ filePath: string; error?: string }>> {
    if (drafts.length === 0) return []
    throwIfGraphExtractAborted(signal)
    onPhase?.('recalling')
    const vaultId = drafts[0]!.vaultId
    const now = Date.now()
    const aligned = await alignEntityPool(
      drafts.flatMap((draft) =>
        draft.entities.map((ent) => ({
          name: ent.name,
          nodeType: ent.type,
          aliases: ent.aliases,
          summary: ent.summary
        }))
      ),
      {
        findByNameOrAlias: async (name, type) => {
          const hit = await this.repo.findNodeByNameOrAlias(vaultId, name, type)
          if (!hit) return null
          return { id: hit.id, name: hit.name, aliases: hit.aliases, summary: hit.summary }
        },
        searchByVector: this.alignDeps?.embedQuery
          ? async (vector, type, topK) => {
              const hits = await this.repo.searchNodesByVector(vaultId, vector, topK ?? 5, {
                nodeType: type,
                modelId: this.alignDeps?.modelId
              })
              return hits.map((hit) => ({
                id: hit.id,
                name: hit.name,
                aliases: hit.aliases,
                summary: hit.summary,
                nodeType: hit.nodeType,
                distance: hit.distance
              }))
            }
          : undefined,
        embedQuery: this.alignDeps?.embedQuery,
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(vaultId, type, name),
        judgeMerges: async (input) => {
          throwIfGraphExtractAborted(signal)
          onPhase?.('waiting_align')
          const prompt = buildEntityAlignPrompt(input)
          onPhase?.('aligning')
          const text = await this.llm({
            ...prompt,
            signal
          })
          throwIfGraphExtractAborted(signal)
          return parseEntityAlignDecisions(text)
        }
      }
    )

    throwIfGraphExtractAborted(signal)
    onPhase?.('writing')

    const results: Array<{ filePath: string; error?: string }> = []
    const touchedNodeIds: string[] = []
    const shardMonths = new Set<string>()

    for (const draft of drafts) {
      throwIfGraphExtractAborted(signal)
      try {
        const ids = await this.persistDraft(draft, aligned, now)
        touchedNodeIds.push(...ids)
        shardMonths.add(draft.shardMonth)
        results.push({ filePath: draft.filePath })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        results.push({ filePath: draft.filePath, error: message })
        logger.warn(`[GraphExtract] commit failed ${draft.filePath}:`, e as Error)
      }
    }

    for (const month of shardMonths) {
      await this.graphManager.compactShard('nodes', month)
      await this.graphManager.compactShard('edges', month)
    }

    await this.graphSync.syncPendingIndex({ absentSweep: 'shard-present' })
    if (touchedNodeIds.length > 0) {
      const uniqueIds = [...new Set(touchedNodeIds)]
      await this.repo.recountMentions(vaultId, uniqueIds)
      await this.writeMentionCountsToJsonl(vaultId, drafts[0]!.vaultName, uniqueIds)
    }
    const draftByPath = new Map(drafts.map((draft) => [draft.filePath, draft]))
    for (const result of results) {
      if (result.error) continue
      const draft = draftByPath.get(result.filePath)
      if (!draft) continue
      await this.freshness.commitReextract(normalizeFilePath(draft.filePath), draft.hash)
    }
    return results
  }

  private async persistDraft(
    draft: GraphExtractDraft,
    aligned: Awaited<ReturnType<typeof alignEntityPool>>,
    now: number
  ): Promise<string[]> {
    const { vaultId, vaultName, filePath, hash, dateStr, shardMonth, validFrom } = draft
    const sourceRef = dateStr || filePath
    const nameToId = new Map<string, string>()
    const nodeRecords: GraphNodeRawRecord[] = []
    const edgeRecords: GraphEdgeRawRecord[] = []
    const touchedNodeIds: string[] = []

    const entryName = dateStr || '日记'
    const legacyEntryId = legacyEntryNodeIdForFilePath(filePath)
    const entryCreated = await findOrCreateGraphNode(this.repo, {
      vaultId,
      vaultName,
      nodeType: 'entry',
      name: entryName,
      aliases: dateStr ? [dateStr] : [],
      shardMonth,
      entryFilePath: filePath,
      origin: 'ai',
      reviewStatus: 'approved',
      now,
      seenAt: validFrom
    })
    nodeRecords.push(entryCreated.record)
    touchedNodeIds.push(entryCreated.id)
    nameToId.set(normalizeGraphName(entryName), entryCreated.id)
    if (dateStr) nameToId.set(normalizeGraphName(dateStr), entryCreated.id)
    nameToId.set('entry', entryCreated.id)

    for (const ent of draft.entities) {
      const hit = aligned.get(entityAlignKey(ent.type, ent.name))
      const created = await findOrCreateGraphNode(this.repo, {
        vaultId,
        vaultName,
        nodeType: ent.type,
        name: hit?.canonicalName || ent.name,
        aliases: hit?.aliases ?? ent.aliases,
        summary: hit?.summary || ent.summary,
        shardMonth,
        origin: 'ai',
        reviewStatus: graphReviewStatusFromConfidence(ent.confidence),
        now,
        seenAt: validFrom,
        forceId: hit?.id
      })
      nodeRecords.push(created.record)
      touchedNodeIds.push(created.id)
      nameToId.set(normalizeGraphName(ent.name), created.id)
      if (hit?.canonicalName) nameToId.set(normalizeGraphName(hit.canonicalName), created.id)
    }

    const typeByName = new Map<string, string>()
    for (const ent of draft.entities) {
      const key = normalizeGraphName(ent.name)
      if (key) typeByName.set(key, ent.type)
    }
    for (const edge of draft.edges) {
      const fromId = await resolveGraphEndpointId(this.repo, vaultId, edge.from, nameToId, {
        nodeType: typeByName.get(normalizeGraphName(edge.from)),
        role: 'from',
        sourceRef
      })
      const toId = await resolveGraphEndpointId(this.repo, vaultId, edge.to, nameToId, {
        nodeType: typeByName.get(normalizeGraphName(edge.to)),
        role: 'to',
        sourceRef
      })
      if (!fromId || !toId) continue
      const reviewStatus = graphReviewStatusFromConfidence(edge.confidence)
      edgeRecords.push({
        id: graphEdgeId(vaultId, fromId, toId, edge.type, sourceRef),
        schemaVersion: 1,
        vaultId,
        vaultName,
        fromId,
        toId,
        edgeType: edge.type,
        props: {},
        validFrom,
        validTo: null,
        isCurrent: true,
        sourceKind: 'diary',
        sourceRef,
        sourceExcerpt: edge.excerpt,
        sourceContentHash: hash,
        confidence: edge.confidence,
        origin: 'ai',
        reviewStatus,
        shardMonth,
        createdAt: validFrom,
        updatedAt: now,
        deletedAt: null
      })
      touchedNodeIds.push(fromId, toId)
    }

    for (const record of nodeRecords) {
      await this.graphManager.writeRecord(record, { collection: 'nodes' })
    }
    const existingLegacy = await this.repo.getNodeById(legacyEntryId, vaultId)
    if (existingLegacy && legacyEntryId !== entryCreated.id) {
      const listEdges = this.repo.listEdgesTouching
      if (typeof listEdges === 'function') {
        const touching = await listEdges.call(this.repo, vaultId, legacyEntryId)
        for (const edge of touching) {
          const month = edge.shardMonth || shardMonth
          if (!month) continue
          const fromId = edge.fromId === legacyEntryId ? entryCreated.id : edge.fromId
          const toId = edge.toId === legacyEntryId ? entryCreated.id : edge.toId
          if (fromId === toId) {
            try {
              await this.graphManager.removeRecordsFromShard('edges', month, [edge.id])
            } catch {
              // Self-loop may already be absent on disk
            }
            continue
          }
          await this.graphManager.writeRecord(
            {
              id: edge.id,
              schemaVersion: 1,
              vaultId,
              vaultName,
              fromId,
              toId,
              edgeType: edge.edgeType,
              props: parseJsonObject(edge.propsJson),
              validFrom: edge.validFrom,
              validTo: edge.validTo,
              isCurrent: edge.isCurrent,
              sourceKind: edge.sourceKind,
              sourceRef: edge.sourceRef,
              sourceExcerpt: edge.sourceExcerpt,
              sourceContentHash: edge.sourceContentHash,
              confidence: edge.confidence,
              origin: preferGraphOrigin(edge.origin),
              reviewStatus:
                edge.reviewStatus === 'pending' || edge.reviewStatus === 'rejected'
                  ? edge.reviewStatus
                  : 'approved',
              shardMonth: month,
              createdAt: edge.createdAt,
              updatedAt: now,
              deletedAt: null
            },
            { collection: 'edges' }
          )
        }
      }
      try {
        await this.graphManager.removeRecordsFromShard(
          'nodes',
          existingLegacy.shardMonth || shardMonth,
          [legacyEntryId]
        )
      } catch {
        // Legacy may already be absent on disk
      }
    }
    const newEdgeIds = new Set<string>()
    for (const record of edgeRecords) {
      newEdgeIds.add(record.id)
      await this.graphManager.writeRecord(record, { collection: 'edges' })
    }
    await this.graphManager.supersedeAiEdgesBySourceRef(sourceRef, {
      exceptIds: newEdgeIds,
      shardMonth
    })
    return touchedNodeIds
  }

  private async assertEmbeddingConfigured(): Promise<void> {
    const check = this.alignDeps?.isEmbeddingConfigured
    if (!check) return
    const ok = await check()
    if (!ok) {
      throw new Error(GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR)
    }
  }

  private async assertDiaryEmbedded(filePath: string): Promise<void> {
    const check = this.alignDeps?.isDiaryEmbedded
    if (!check) return
    const ok = await check(filePath)
    if (!ok) {
      throw new Error(GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR)
    }
  }

  private async resolveAbsolutePath(filePath: string): Promise<string> {
    const rel = normalizeFilePath(filePath)
    if (!rel || rel.includes('\0') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) {
      throw new Error(`Invalid diary path (must be vault-relative): ${filePath}`)
    }
    if (rel.split('/').some((seg) => seg === '..')) {
      throw new Error(`Invalid diary path (path traversal): ${filePath}`)
    }
    const vault = await this.pathService.getActiveVaultPath()
    if (!vault) throw new Error('No active vault')
    const abs = path.resolve(vault, rel)
    if (!isPathInsideVault(vault, abs)) {
      throw new Error(`Diary path escapes vault: ${filePath}`)
    }
    if (!(await this.fs.exists(abs))) {
      throw new Error(`Diary file not found: ${rel}`)
    }
    return abs
  }

  private async writeMentionCountsToJsonl(
    vaultId: string,
    vaultName: string,
    nodeIds: string[]
  ): Promise<void> {
    for (const id of nodeIds) {
      const row = await this.repo.getNodeById(id, vaultId)
      if (!row) continue
      const writtenAt = Math.max(Date.now(), row.updatedAt ?? 0) + 1
      let props: Record<string, unknown> = {}
      try {
        props = JSON.parse(row.propsJson || '{}') as Record<string, unknown>
      } catch {
        props = {}
      }
      const record: GraphNodeRawRecord = {
        id: row.id,
        schemaVersion: 1,
        vaultId,
        vaultName,
        nodeType: row.nodeType,
        name: row.name,
        aliases: row.aliases,
        summary: row.summary,
        props,
        mentionCount: row.mentionCount,
        firstSeenAt: row.firstSeenAt ?? writtenAt,
        lastSeenAt: row.lastSeenAt ?? writtenAt,
        origin: preferGraphOrigin(row.origin),
        shardMonth: row.shardMonth,
        createdAt: row.createdAt,
        updatedAt: writtenAt,
        deletedAt: row.deletedAt,
        reviewStatus:
          row.reviewStatus === 'pending' || row.reviewStatus === 'rejected'
            ? row.reviewStatus
            : 'approved'
      }
      await this.graphManager.writeRecord(record, { collection: 'nodes' })
    }
  }
}

/** Test helper: clamp enums without LLM */
export function clampGraphExtractEnumsForTest(input: { nodeType: string; edgeType: string }): {
  nodeType: string
  edgeType: string
} {
  return {
    nodeType: clampNodeType(input.nodeType),
    edgeType: clampEdgeType(input.edgeType)
  }
}
