import { generateText } from 'ai'
import {
  GRAPH_EDGE_TYPES,
  GRAPH_NODE_TYPES,
  type GraphRepository
} from '@baishou/database'
import type { IAIProvider } from '@baishou/ai'
import { wrapLanguageModelWithMiddlewares } from '@baishou/ai'
import { logger } from '@baishou/shared'
import type { IFileSystem } from '../fs/file-system.types'
import { md5Hex } from '../fs/md5'
import * as path from '../fs/path.util'
import type { IStoragePathService } from '../vault/storage-path.types'
import type { DerivedFreshnessService } from '../raw-data/derived-freshness.service'
import type { GraphRawManager } from '../raw-data/managers/graph.raw-manager'
import type { GraphEdgeRawRecord, GraphNodeRawRecord } from '../raw-data/raw-data-source.types'
import type { GraphSyncService } from '../raw-data/graph-sync.service'

const NODE_TYPE_SET = new Set<string>(GRAPH_NODE_TYPES)
const EDGE_TYPE_SET = new Set<string>(GRAPH_EDGE_TYPES)
const LOW_CONFIDENCE = 70

export interface GraphExtractLlmDeps {
  provider: IAIProvider
  modelId: string
}

export type GraphExtractLlmFn = (prompt: {
  system: string
  user: string
}) => Promise<string | null>

export interface ExtractDiariesOptions {
  vaultName: string
  /** Empty = all pending-reextract */
  filePaths?: string[]
  onProgress?: (p: { current: number; total: number; filePath: string }) => void
}

export interface ExtractDiariesResult {
  done: number
  failed: number
  errors: Array<{ filePath: string; message: string }>
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
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '')
}

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

/** Stable entry node id from diary path (uuid-shaped hex). */
export function entryNodeIdForFilePath(filePath: string): string {
  const hex = md5Hex(normalizeFilePath(filePath))
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function clampNodeType(raw: string): string {
  const t = raw.trim().toLowerCase()
  return NODE_TYPE_SET.has(t) ? t : 'topic'
}

function clampEdgeType(raw: string): string {
  const t = raw.trim().toLowerCase()
  return EDGE_TYPE_SET.has(t) ? t : 'relates_to'
}

function parseExtractJson(text: string): LlmExtractPayload | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as Partial<LlmExtractPayload>
    return {
      entities: Array.isArray(parsed.entities) ? (parsed.entities as LlmEntity[]) : [],
      edges: Array.isArray(parsed.edges) ? (parsed.edges as LlmEdge[]) : []
    }
  } catch {
    return null
  }
}

function dateFromFilePath(filePath: string): string | null {
  const m = normalizeFilePath(filePath).match(/(\d{4}-\d{2}-\d{2})/)
  return m?.[1] ?? null
}

function shardMonthFromDate(dateStr: string | null, now: number): string {
  if (dateStr) {
    const m = dateStr.match(/^(\d{4})-(\d{2})/)
    if (m) return `${m[1]}-${m[2]}`
  }
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildExtractPrompt(diaryText: string, dateStr: string | null): {
  system: string
  user: string
} {
  const nodeTypes = GRAPH_NODE_TYPES.join(', ')
  const edgeTypes = GRAPH_EDGE_TYPES.join(', ')
  return {
    system:
      '你是日记关系图谱抽取器。只输出严格 JSON，不要 markdown 代码块，不要额外解释。',
    user: `从以下日记中抽取实体与关系。

## 约束
1. node type 只能是: ${nodeTypes}
2. edge type 只能是: ${edgeTypes}
3. 不要编造日记未出现的事实；不确定的实体/边给较低 confidence（0-100）
4. 实体 name 用日记中的称呼；可填 aliases
5. edges.from / edges.to 使用实体 name（或 entry 锚点名）
6. 每篇日记都有一个结构性锚点 entry（name 用日期或「日记」），实体应尽量连到 entry（mentions / participates_in / evokes 等）

## 日记日期
${dateStr || '未知'}

## 日记正文
${diaryText.slice(0, 12000)}

## 输出格式（严格 JSON）
{"entities":[{"name":"","type":"person","aliases":[],"summary":"","confidence":80}],"edges":[{"from":"","to":"","type":"mentions","excerpt":"","confidence":80}]}`
  }
}

export function createDefaultGraphExtractLlm(deps: GraphExtractLlmDeps): GraphExtractLlmFn {
  return async ({ system, user }) => {
    try {
      const baseModel = deps.provider.getLanguageModel(deps.modelId)
      const model = wrapLanguageModelWithMiddlewares(baseModel, {
        providerType: deps.provider.config?.type || 'openai',
        providerId: deps.provider.config?.id,
        modelId: deps.modelId
      })
      const { text } = await generateText({
        model,
        system,
        messages: [{ role: 'user', content: user }],
        temperature: 0.1
      })
      return text?.trim() || null
    } catch (e) {
      logger.warn('[GraphExtract] LLM call failed:', e as Error)
      return null
    }
  }
}

/**
 * Manual diary → graph LLM extraction (management UI).
 * Order: file write → pending-index sync → commitReextract.
 * LLM failure leaves the diary in pending-reextract.
 */
export class GraphLlmExtractionService {
  constructor(
    private readonly graphManager: GraphRawManager,
    private readonly freshness: DerivedFreshnessService,
    private readonly repo: GraphRepository,
    private readonly graphSync: GraphSyncService,
    private readonly pathService: IStoragePathService,
    private readonly fs: IFileSystem,
    private readonly llm: GraphExtractLlmFn
  ) {}

  async extractDiaries(opts: ExtractDiariesOptions): Promise<ExtractDiariesResult> {
    const pending = await this.freshness.listPendingReextract()
    const wanted = new Set(
      (opts.filePaths ?? []).map(normalizeFilePath).filter(Boolean)
    )
    const targets =
      wanted.size === 0 ? pending : pending.filter((p) => wanted.has(normalizeFilePath(p.filePath)))

    let done = 0
    let failed = 0
    const errors: Array<{ filePath: string; message: string }> = []

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]!
      opts.onProgress?.({
        current: i + 1,
        total: targets.length,
        filePath: target.filePath
      })
      try {
        await this.extractOne(opts.vaultName, target.filePath, target.contentHash)
        done += 1
      } catch (e) {
        failed += 1
        const message = e instanceof Error ? e.message : String(e)
        errors.push({ filePath: target.filePath, message })
        logger.warn(`[GraphExtract] failed ${target.filePath}:`, e as Error)
      }
    }

    return { done, failed, errors }
  }

  private async resolveAbsolutePath(filePath: string): Promise<string> {
    const rel = normalizeFilePath(filePath)
    const vault = await this.pathService.getActiveVaultPath()
    if (vault) {
      const abs = path.join(vault, rel)
      if (await this.fs.exists(abs)) return abs
    }
    // Fallback: filePath may already be absolute
    if (await this.fs.exists(filePath)) return filePath
    throw new Error(`Diary file not found: ${rel}`)
  }

  private async extractOne(
    vaultName: string,
    filePath: string,
    contentHash: string
  ): Promise<void> {
    const abs = await this.resolveAbsolutePath(filePath)
    const raw = await this.fs.readFile(abs, 'utf8')
    const actualHash = md5Hex(raw)
    const hash = actualHash || contentHash
    const dateStr = dateFromFilePath(filePath)
    const prompt = buildExtractPrompt(raw, dateStr)
    const text = await this.llm(prompt)
    if (!text) {
      throw new Error('LLM returned empty response')
    }
    const payload = parseExtractJson(text)
    if (!payload) {
      throw new Error('Failed to parse LLM JSON')
    }

    const now = Date.now()
    const sourceRef = dateStr || normalizeFilePath(filePath)
    const shardMonth = shardMonthFromDate(dateStr, now)
    const nameToId = new Map<string, string>()

    // Structural entry anchor
    const entryId = entryNodeIdForFilePath(filePath)
    const entryName = dateStr || '日记'
    const entryRecord: GraphNodeRawRecord = {
      id: entryId,
      schemaVersion: 1,
      vaultName,
      nodeType: 'entry',
      name: entryName,
      aliases: dateStr ? [dateStr] : [],
      summary: '',
      props: { filePath: normalizeFilePath(filePath) },
      mentionCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      origin: 'ai',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      reviewStatus: 'approved'
    }
    await this.graphManager.writeRecord(entryRecord, { collection: 'nodes' })
    nameToId.set(entryName.toLowerCase(), entryId)
    if (dateStr) nameToId.set(dateStr.toLowerCase(), entryId)
    nameToId.set('entry', entryId)

    for (const ent of payload.entities) {
      const name = String(ent.name || '').trim()
      if (!name) continue
      const nodeType = clampNodeType(String(ent.type || 'topic'))
      if (nodeType === 'entry') continue
      const confidence =
        typeof ent.confidence === 'number'
          ? Math.max(0, Math.min(100, Math.round(ent.confidence)))
          : 80
      const reviewStatus = confidence < LOW_CONFIDENCE ? 'pending' : 'approved'

      let id: string | null = null
      const existing = await this.repo.findNodeByNameOrAlias(vaultName, name, nodeType)
      if (existing) {
        id = existing.id
      } else {
        id = newId('n')
      }

      const aliases = Array.isArray(ent.aliases)
        ? ent.aliases.filter((a): a is string => typeof a === 'string')
        : []
      const record: GraphNodeRawRecord = {
        id,
        schemaVersion: 1,
        vaultName,
        nodeType,
        name,
        aliases,
        summary: typeof ent.summary === 'string' ? ent.summary : '',
        props: {},
        mentionCount: existing ? existing.mentionCount + 1 : 1,
        firstSeenAt: existing?.firstSeenAt ?? now,
        lastSeenAt: now,
        origin: 'ai',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
        reviewStatus
      }
      await this.graphManager.writeRecord(record, { collection: 'nodes' })
      nameToId.set(name.toLowerCase(), id)
    }

    await this.graphManager.supersedeAiEdgesBySourceRef(sourceRef)

    for (const edge of payload.edges) {
      const fromRaw = String(edge.from || '').trim()
      const toRaw = String(edge.to || '').trim()
      if (!fromRaw || !toRaw) continue
      const fromId = nameToId.get(fromRaw.toLowerCase())
      const toId = nameToId.get(toRaw.toLowerCase())
      if (!fromId || !toId) continue
      const confidence =
        typeof edge.confidence === 'number'
          ? Math.max(0, Math.min(100, Math.round(edge.confidence)))
          : 75
      const reviewStatus = confidence < LOW_CONFIDENCE ? 'pending' : 'approved'
      const record: GraphEdgeRawRecord = {
        id: newId('e'),
        schemaVersion: 1,
        vaultName,
        fromId,
        toId,
        edgeType: clampEdgeType(String(edge.type || 'relates_to')),
        props: {},
        validFrom: now,
        validTo: null,
        isCurrent: true,
        sourceKind: 'diary',
        sourceRef,
        sourceExcerpt: typeof edge.excerpt === 'string' ? edge.excerpt : '',
        sourceContentHash: hash,
        confidence,
        origin: 'ai',
        reviewStatus,
        shardMonth,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }
      await this.graphManager.writeRecord(record, { collection: 'edges' })
    }

    await this.graphSync.syncPendingIndex()
    await this.freshness.commitReextract(normalizeFilePath(filePath), hash)
    // extract-state write marks pending-index; hydrate cursor shard
    await this.graphSync.syncPendingIndex()
  }
}

/** Test helper: clamp enums without LLM */
export function clampGraphExtractEnumsForTest(input: {
  nodeType: string
  edgeType: string
}): { nodeType: string; edgeType: string } {
  return {
    nodeType: clampNodeType(input.nodeType),
    edgeType: clampEdgeType(input.edgeType)
  }
}
