import type { GraphExtractStore } from '@baishou/database/shared'
import {
  logger,
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  GRAPH_EXTRACT_ALIGN_POOL_SIZE,
  GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR,
  GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR,
  GRAPH_EXTRACT_EMPTY_RESPONSE_ERROR,
  GRAPH_EXTRACT_PARSE_JSON_ERROR,
  entryNodeIdForFilePath,
  graphDiaryInstant,
  graphNodeIdForEntity,
  legacyEntryNodeIdForFilePath,
  normalizeGraphExtractConfidence,
  normalizeGraphFilePath,
  graphExtractPhaseProgress,
  type GraphExtractQueuePhase,
  type GraphExtractQueueProgressUpdate
} from '@baishou/shared'
import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { md5Hex } from '../fs/md5'
import type { IStoragePathService } from '../vault/storage-path.types'
import type { DerivedFreshnessService } from '../raw-data/derived-freshness.service'
import type { GraphPendingIndexSync } from '../raw-data/graph-sync.service'
import type { GraphExtractRawWriter } from '../raw-data/graph-extract-raw'
import {
  alignEntityPool,
  buildEntityAlignPrompt,
  buildNameCandidateJudgePrompt,
  clipNameCandidateSourceContext,
  parseEntityAlignJudgeOutput,
  parseNameCandidateDecision
} from './graph-entity-align'
import type {
  ExtractDiariesOptions,
  ExtractDiariesResult,
  GraphExtractAlignDeps,
  GraphExtractDraft,
  GraphExtractDraftEdge,
  GraphExtractDraftEntity,
  GraphExtractLlmFn
} from './graph-llm-extraction.types'
import { throwIfGraphExtractAborted } from './graph-llm-extraction.stream'
import {
  buildExtractPrompt,
  clampEdgeType,
  clampNodeType,
  parseExtractJson
} from './graph-llm-extraction.prompt'
import { persistGraphExtractDraft, writeMentionCountsToJsonl } from './graph-llm-extraction.persist'

export { entryNodeIdForFilePath, legacyEntryNodeIdForFilePath }
export * from './graph-llm-extraction.types'
export {
  collectGraphExtractStreamText,
  resolveGraphExtractLlmText
} from './graph-llm-extraction.stream'
export {
  buildExtractPrompt,
  clampGraphExtractEnumsForTest,
  createDefaultGraphExtractLlm,
  estimateExtractionCost,
  estimateTokensForDiaryChars,
  extractFirstJsonObject
} from './graph-llm-extraction.prompt'

function normalizeFilePath(filePath: string): string {
  return normalizeGraphFilePath(filePath)
}

function isPathInsideVault(vaultRoot: string, absolutePath: string): boolean {
  const root = path.resolve(vaultRoot).replace(/\\/g, '/').replace(/\/+$/, '')
  const abs = path.resolve(absolutePath).replace(/\\/g, '/')
  const rootLower = root.toLowerCase()
  const absLower = abs.toLowerCase()
  return absLower === rootLower || absLower.startsWith(`${rootLower}/`)
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
      edges,
      sourceContext: clipNameCandidateSourceContext(raw)
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
          summary: ent.summary,
          sourceContext: draft.sourceContext
        }))
      ),
      {
        findCandidatesByNameOrAlias: async (name, type) => {
          const hits = await this.repo.findNodesByNameOrAlias(vaultId, name, type)
          return hits.map((hit) => ({
            id: hit.id,
            name: hit.name,
            aliases: hit.aliases,
            summary: hit.summary,
            discriminator: hit.discriminator
          }))
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
          return parseEntityAlignJudgeOutput(text)
        },
        judgeNameCandidates: async (input) => {
          throwIfGraphExtractAborted(signal)
          onPhase?.('waiting_align')
          const prompt = buildNameCandidateJudgePrompt(input)
          onPhase?.('aligning')
          const text = await this.llm({
            ...prompt,
            signal
          })
          throwIfGraphExtractAborted(signal)
          return parseNameCandidateDecision(text)
        }
      }
    )

    throwIfGraphExtractAborted(signal)
    onPhase?.('writing')

    const results: Array<{ filePath: string; error?: string }> = []
    const touchedNodeIds: string[] = []
    const alignedEmbeddings: Array<{ id: string; embedding: number[]; text: string }> = []
    const shardMonths = new Set<string>()
    const persistCtx = { repo: this.repo, graphManager: this.graphManager }

    for (const draft of drafts) {
      throwIfGraphExtractAborted(signal)
      try {
        const persisted = await persistGraphExtractDraft(persistCtx, draft, aligned, now)
        touchedNodeIds.push(...persisted.nodeIds)
        alignedEmbeddings.push(...persisted.embeddings)
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

    const precomputedNodeEmbeddings = new Map<string, { embedding: number[]; text: string }>()
    for (const item of alignedEmbeddings) {
      if (precomputedNodeEmbeddings.has(item.id)) continue
      precomputedNodeEmbeddings.set(item.id, { embedding: item.embedding, text: item.text })
    }
    await this.graphSync.syncPendingIndex({
      absentSweep: 'shard-present',
      precomputedNodeEmbeddings
    })
    if (touchedNodeIds.length > 0) {
      const uniqueIds = [...new Set(touchedNodeIds)]
      await this.repo.recountMentions(vaultId, uniqueIds)
      await writeMentionCountsToJsonl(persistCtx, vaultId, drafts[0]!.vaultName, uniqueIds)
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
}
