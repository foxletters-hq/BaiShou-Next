import { HybridSearchUtils } from '@baishou/ai'
import {
  bytesToFloat32Array,
  embeddingVectorToBytes,
  type ISearchResult,
  type SearchSource
} from '@baishou/shared'

export interface KnowledgeSearchHit {
  chunkId: string
  sourceId: string
  notebookId: string
  chunkIndex: number
  chunkText: string
  score: number
  source: SearchSource
  offset?: number
  len?: number
  title?: string
  metadataJson?: string
}

export interface KnowledgeSqlExecutor {
  all(sql: string, params?: unknown[]): Array<Record<string, unknown>>
}

export interface KnowledgeSearchDeps {
  sql: KnowledgeSqlExecutor
  /** 可选：补充资料标题 */
  getSourceTitle?: (sourceId: string) => Promise<string | null> | string | null
}

export interface KnowledgeSearchOptions {
  /** 强制笔记本隔离；空值直接拒绝 */
  notebookId: string
  query: string
  queryVector: number[]
  topK?: number
  ftsWeight?: number
  vectorWeight?: number
}

function parseMetadata(raw: unknown): { offset?: number; len?: number } {
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as { offset?: unknown; len?: unknown }
    return {
      offset: typeof parsed.offset === 'number' ? parsed.offset : undefined,
      len: typeof parsed.len === 'number' ? parsed.len : undefined
    }
  } catch {
    return {}
  }
}

function sanitizeFtsQuery(query: string): string {
  return query.replace(/"/g, ' ').trim()
}

function toSearchResult(row: {
  chunkId: string
  sourceId: string
  chunkText: string
  score: number
  source: SearchSource
  createdAt?: number
}): ISearchResult {
  return {
    messageId: row.chunkId,
    sessionId: row.sourceId,
    chunkText: row.chunkText,
    score: row.score,
    source: row.source,
    createdAt: row.createdAt,
    sourceId: row.sourceId
  }
}

function embeddingFromCell(value: unknown, dimension: number): number[] | null {
  if (value == null) return null
  try {
    if (value instanceof Uint8Array) {
      return Array.from(bytesToFloat32Array(value, dimension))
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
      return Array.from(bytesToFloat32Array(new Uint8Array(value), dimension))
    }
    if (value instanceof ArrayBuffer) {
      return Array.from(bytesToFloat32Array(new Uint8Array(value), dimension))
    }
  } catch {
    return null
  }
  return null
}

/**
 * 知识库混合检索：向量 + 真 FTS5 + RRF。
 * 强制按 notebook_id 过滤，缺省或空 notebookId 时 fail-closed（抛错 / 空结果不跨本）。
 */
const SEARCHABLE_SOURCE_STATUSES = "('ready', 'partial')"
const VEC_RETRY_COOLDOWN_MS = 60_000

export class KnowledgeSearchService {
  private vecDisabledUntil = 0

  constructor(private readonly deps: KnowledgeSearchDeps) {}

  async search(opts: KnowledgeSearchOptions): Promise<KnowledgeSearchHit[]> {
    const notebookId = opts.notebookId?.trim()
    if (!notebookId) {
      throw new Error('knowledge search requires notebookId')
    }

    const topK = Math.max(1, opts.topK ?? 10)
    const queryText = opts.query.trim()
    const queryVector = opts.queryVector

    const [ftsHits, vectorHits] = await Promise.all([
      queryText
        ? this.queryFts(notebookId, queryText, topK)
        : Promise.resolve([] as KnowledgeSearchHit[]),
      queryVector.length > 0
        ? this.queryVector(notebookId, queryVector, topK)
        : Promise.resolve([] as KnowledgeSearchHit[])
    ])

    const metaByChunk = new Map<string, KnowledgeSearchHit>()
    for (const hit of [...ftsHits, ...vectorHits]) {
      if (!metaByChunk.has(hit.chunkId)) metaByChunk.set(hit.chunkId, hit)
    }

    let merged: ISearchResult[]
    if (ftsHits.length === 0) {
      merged = vectorHits.map((h) =>
        toSearchResult({
          chunkId: h.chunkId,
          sourceId: h.sourceId,
          chunkText: h.chunkText,
          score: h.score,
          source: h.source
        })
      )
    } else if (vectorHits.length === 0) {
      merged = ftsHits.map((h) =>
        toSearchResult({
          chunkId: h.chunkId,
          sourceId: h.sourceId,
          chunkText: h.chunkText,
          score: h.score,
          source: h.source
        })
      )
    } else {
      merged = HybridSearchUtils.mergeRRF(
        ftsHits.map((h) =>
          toSearchResult({
            chunkId: h.chunkId,
            sourceId: h.sourceId,
            chunkText: h.chunkText,
            score: h.score,
            source: 'fts'
          })
        ),
        vectorHits.map((h) =>
          toSearchResult({
            chunkId: h.chunkId,
            sourceId: h.sourceId,
            chunkText: h.chunkText,
            score: h.score,
            source: 'vector'
          })
        ),
        topK,
        opts.ftsWeight ?? 0.3,
        opts.vectorWeight ?? 0.7
      )
    }

    const hits: KnowledgeSearchHit[] = []
    for (const row of merged.slice(0, topK)) {
      const base = metaByChunk.get(row.messageId)
      if (!base || base.notebookId !== notebookId) continue
      hits.push({
        ...base,
        score: row.score,
        source: row.source
      })
    }

    if (this.deps.getSourceTitle) {
      await Promise.all(
        hits.map(async (hit) => {
          if (hit.title) return
          const title = await this.deps.getSourceTitle!(hit.sourceId)
          if (title) hit.title = title
        })
      )
    }

    return hits
  }

  private async queryFts(
    notebookId: string,
    query: string,
    limit: number
  ): Promise<KnowledgeSearchHit[]> {
    const cleaned = sanitizeFtsQuery(query)
    if (!cleaned) return []

    try {
      const rows = this.deps.sql.all(
        `
        SELECT
          c.chunk_id AS chunkId,
          c.source_id AS sourceId,
          c.notebook_id AS notebookId,
          c.chunk_index AS chunkIndex,
          c.chunk_text AS chunkText,
          c.metadata_json AS metadataJson,
          rank AS ftsRank
        FROM knowledge_chunks_fts
        JOIN knowledge_chunks c ON c.id = knowledge_chunks_fts.rowid
        JOIN knowledge_sources s ON s.id = c.source_id
        WHERE knowledge_chunks_fts MATCH ?
          AND c.notebook_id = ?
          AND s.status IN ${SEARCHABLE_SOURCE_STATUSES}
        ORDER BY rank
        LIMIT ?
        `,
        [`"${cleaned}"`, notebookId, limit]
      )

      return rows
        .filter((r) => String(r.notebookId) === notebookId)
        .map((r, i) => {
          const meta = parseMetadata(r.metadataJson)
          return {
            chunkId: String(r.chunkId),
            sourceId: String(r.sourceId),
            notebookId: String(r.notebookId),
            chunkIndex: Number(r.chunkIndex ?? 0),
            chunkText: String(r.chunkText ?? ''),
            score: limit - i,
            source: 'fts' as const,
            offset: meta.offset,
            len: meta.len,
            metadataJson: typeof r.metadataJson === 'string' ? r.metadataJson : undefined
          }
        })
    } catch {
      return []
    }
  }

  private async queryVector(
    notebookId: string,
    queryVector: number[],
    limit: number
  ): Promise<KnowledgeSearchHit[]> {
    if (Date.now() >= this.vecDisabledUntil) {
      try {
        return this.queryWithVecDistanceCosine(notebookId, queryVector, limit)
      } catch {
        this.vecDisabledUntil = Date.now() + VEC_RETRY_COOLDOWN_MS
      }
    }
    return this.queryWithJsCosine(notebookId, queryVector, limit)
  }

  private queryWithVecDistanceCosine(
    notebookId: string,
    queryVector: number[],
    limit: number
  ): KnowledgeSearchHit[] {
    const vectorBuffer = embeddingVectorToBytes(queryVector)
    const rows = this.deps.sql.all(
      `
        SELECT
        c.chunk_id AS chunkId,
        c.source_id AS sourceId,
        c.notebook_id AS notebookId,
        c.chunk_index AS chunkIndex,
        c.chunk_text AS chunkText,
        c.metadata_json AS metadataJson,
        vec_distance_cosine(c.embedding, ?) AS distance
      FROM knowledge_chunks c
      JOIN knowledge_sources s ON s.id = c.source_id
      WHERE c.notebook_id = ?
        AND s.status IN ${SEARCHABLE_SOURCE_STATUSES}
      ORDER BY vec_distance_cosine(c.embedding, ?) ASC
      LIMIT ?
      `,
      [vectorBuffer, notebookId, vectorBuffer, limit]
    )

    return rows
      .filter((r) => String(r.notebookId) === notebookId)
      .map((r) => {
        const meta = parseMetadata(r.metadataJson)
        const distance = typeof r.distance === 'number' ? r.distance : Number(r.distance ?? 1)
        return {
          chunkId: String(r.chunkId),
          sourceId: String(r.sourceId),
          notebookId: String(r.notebookId),
          chunkIndex: Number(r.chunkIndex ?? 0),
          chunkText: String(r.chunkText ?? ''),
          score: 1 - (Number.isFinite(distance) ? distance : 1),
          source: 'vector' as const,
          offset: meta.offset,
          len: meta.len,
          metadataJson: typeof r.metadataJson === 'string' ? r.metadataJson : undefined
        }
      })
  }

  private queryWithJsCosine(
    notebookId: string,
    queryVector: number[],
    limit: number
  ): KnowledgeSearchHit[] {
    const countRows = this.deps.sql.all(
      `
      SELECT count(*) AS c
      FROM knowledge_chunks c
      JOIN knowledge_sources s ON s.id = c.source_id
      WHERE c.notebook_id = ?
        AND s.status IN ${SEARCHABLE_SOURCE_STATUSES}
      `,
      [notebookId]
    )
    if (Number(countRows[0]?.c ?? 0) > 1500) return []

    const rows = this.deps.sql.all(
      `
        SELECT
        c.chunk_id AS chunkId,
        c.source_id AS sourceId,
        c.notebook_id AS notebookId,
        c.chunk_index AS chunkIndex,
        c.chunk_text AS chunkText,
        c.metadata_json AS metadataJson,
        c.embedding AS embedding,
        c.dimension AS dimension
      FROM knowledge_chunks c
      JOIN knowledge_sources s ON s.id = c.source_id
      WHERE c.notebook_id = ?
        AND s.status IN ${SEARCHABLE_SOURCE_STATUSES}
      `,
      [notebookId]
    )

    const scored: KnowledgeSearchHit[] = []
    for (const r of rows) {
      if (String(r.notebookId) !== notebookId) continue
      const dim = Number(r.dimension ?? queryVector.length)
      const embedding = embeddingFromCell(r.embedding, dim)
      if (!embedding || embedding.length !== queryVector.length) continue
      const score = HybridSearchUtils.cosineSimilarity(queryVector, embedding)
      const meta = parseMetadata(r.metadataJson)
      scored.push({
        chunkId: String(r.chunkId),
        sourceId: String(r.sourceId),
        notebookId: String(r.notebookId),
        chunkIndex: Number(r.chunkIndex ?? 0),
        chunkText: String(r.chunkText ?? ''),
        score,
        source: 'vector',
        offset: meta.offset,
        len: meta.len,
        metadataJson: typeof r.metadataJson === 'string' ? r.metadataJson : undefined
      })
    }

    scored.sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
    return scored.slice(0, limit)
  }
}
