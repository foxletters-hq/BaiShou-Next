import {
  bytesToFloat32Array,
  embeddingVectorToBytes,
  hexToBytes,
  ISearchResult,
  logger,
  buildEmbeddingMillisRangePredicates,
  type VectorSearchQueryFilter
} from '@baishou/shared'
import type { ISqlExecutor } from '@baishou/shared'
import { isMissingSqliteFunctionError } from '../utils/sqlite-function-error.util'
import {
  HYBRID_SEARCH_INDEX_NAME,
  HYBRID_SEARCH_TABLE,
  type HybridSearchRuntimeState
} from './hybrid-search.repository.constants'

type QueryFilter = Pick<VectorSearchQueryFilter, 'sourceType' | 'startMs' | 'endMs' | 'vaultId'>
type SqlBindValue = string | number | null | Uint8Array | ArrayBuffer

/** LIKE 兜底检索按空白/标点拆词，避免「工具测试 记忆 日记」这类整句永远匹配不到。 */
function tokenizeKeyword(keyword: string): string[] {
  const terms = keyword
    .trim()
    .split(/[\s,，、;；|/\\。.!！?？:：]+/u)
    .map((term) => term.replace(/[%_]/g, ' ').trim())
    .filter(Boolean)
  return [...new Set(terms)].slice(0, 8)
}

export class HybridSearchVectorQuery {
  constructor(
    private readonly db: ISqlExecutor,
    private readonly runtime: HybridSearchRuntimeState
  ) {}

  /** 是否已确认 sqlite-vec / libsql 原生向量函数可用（不含 JS 降级）。 */
  supportsNativeVectorSearch(): boolean {
    return this.runtime.nativeVectorSupported === true
  }

  private buildWhereClause(
    filter?: QueryFilter,
    columnPrefix = ''
  ): { sql: string; args: SqlBindValue[] } {
    const conditions: string[] = []
    const args: SqlBindValue[] = []

    const vaultId = filter?.vaultId?.trim()
    if (vaultId) {
      conditions.push(`${columnPrefix}vault_id = ?`)
      args.push(vaultId)
    } else {
      // 未传仓库 → fail-closed，避免漏传退化成跨仓库检索
      conditions.push('1 = 0')
    }

    if (filter?.sourceType) {
      conditions.push(`${columnPrefix}source_type = ?`)
      args.push(filter.sourceType)
    }

    const range = buildEmbeddingMillisRangePredicates(
      { startMs: filter?.startMs, endMs: filter?.endMs },
      columnPrefix
    )
    if (range.sql) {
      conditions.push(range.sql)
      args.push(...range.args)
    }

    if (conditions.length === 0) return { sql: '', args: [] }
    return { sql: ` WHERE ${conditions.join(' AND ')}`, args }
  }

  private buildJoinAndClause(
    filter?: QueryFilter,
    columnPrefix = 'ae.'
  ): { sql: string; args: SqlBindValue[] } {
    const where = this.buildWhereClause(filter, columnPrefix)
    if (!where.sql) return { sql: '', args: [] }
    return { sql: where.sql.replace(' WHERE ', ' AND '), args: where.args }
  }

  async queryFTS(
    keyword: string,
    limit: number,
    filter?: Pick<VectorSearchQueryFilter, 'startMs' | 'endMs' | 'vaultId'>
  ): Promise<ISearchResult[]> {
    const terms = tokenizeKeyword(keyword)
    if (terms.length === 0) return []

    const timeWhere = this.buildWhereClause(filter)
    const termPatterns = terms.map((term) => `%${term}%`)
    const matchClause = `(${terms.map(() => 'chunk_text LIKE ?').join(' OR ')})`
    const scoreExpr = terms.map(() => '(CASE WHEN chunk_text LIKE ? THEN 1 ELSE 0 END)').join(' + ')
    const whereSql = timeWhere.sql ? `${timeWhere.sql} AND ${matchClause}` : ` WHERE ${matchClause}`

    const res = await this.db.execute({
      sql: `
        SELECT embedding_id, source_id AS sourceId, group_id AS sessionId, chunk_text AS chunkText,
               source_created_at AS createdAt, source_type AS sourceType,
               (${scoreExpr}) AS matchScore
        FROM ${HYBRID_SEARCH_TABLE}${whereSql}
        ORDER BY matchScore DESC, source_created_at DESC
        LIMIT ?
      `,
      args: [...termPatterns, ...timeWhere.args, ...termPatterns, limit]
    })

    return Array.from(res.rows).map((r, i) => ({
      messageId: r.embedding_id as string,
      sessionId: r.sessionId as string,
      chunkText: r.chunkText as string,
      score: limit - i,
      source: 'fts' as const,
      createdAt: r.createdAt as number,
      sourceType: r.sourceType as string | undefined,
      sourceId: r.sourceId != null ? String(r.sourceId) : undefined
    }))
  }

  async queryNativeVector(
    vector: number[],
    limit: number,
    filter?: VectorSearchQueryFilter
  ): Promise<ISearchResult[]> {
    const threshold = filter?.threshold
    const vectorBuffer = embeddingVectorToBytes(vector)
    const queryFilter: QueryFilter = {
      sourceType: filter?.sourceType,
      startMs: filter?.startMs,
      endMs: filter?.endMs,
      vaultId: filter?.vaultId
    }

    if (this.runtime.vecDistanceCosineAvailable !== false) {
      try {
        const results = await this.queryWithVecDistanceCosine(
          vectorBuffer,
          limit,
          threshold,
          queryFilter
        )
        this.runtime.vecDistanceCosineAvailable = true
        this.runtime.nativeVectorSupported = true
        return results
      } catch (e: any) {
        const message = e?.message ?? String(e)
        if (isMissingSqliteFunctionError(message)) {
          this.runtime.vecDistanceCosineAvailable = false
        }
        logger.warn(
          '[VectorSearch] vec_distance_cosine not available, falling back to high-fidelity JS Cosine:',
          message
        )
      }
    }

    if (this.runtime.vectorTopKAvailable !== false) {
      try {
        const vectorStr = `[${vector.join(',')}]`
        const results = await this.queryWithVectorTopK(vectorStr, limit, threshold, queryFilter)
        this.runtime.vectorTopKAvailable = true
        this.runtime.nativeVectorSupported = true
        return results
      } catch (e: any) {
        const message = e?.message ?? String(e)
        if (isMissingSqliteFunctionError(message)) {
          this.runtime.vectorTopKAvailable = false
        }
        logger.warn(
          '[VectorSearch] vector_top_k not available, falling back to high-fidelity JS Cosine:',
          message
        )
      }
    }

    return this.queryWithJSCosine(vector, limit, threshold, queryFilter)
  }

  private async queryWithVecDistanceCosine(
    vectorBuffer: Uint8Array,
    limit: number,
    threshold?: number,
    filter?: QueryFilter
  ): Promise<ISearchResult[]> {
    const where = this.buildWhereClause(filter)
    const res = await this.db.execute({
      sql: `
        SELECT embedding_id, source_id, group_id AS sessionId, chunk_text AS chunkText,
               source_created_at AS createdAt, source_type AS sourceType,
               vec_distance_cosine(embedding, ?) AS distance
        FROM ${HYBRID_SEARCH_TABLE}${where.sql}
        ORDER BY distance ASC
        LIMIT ?
      `,
      args: [vectorBuffer, ...where.args, limit]
    })

    let results = Array.from(res.rows).map((r) => ({
      messageId: r.embedding_id as string,
      sessionId: r.sessionId as string,
      chunkText: r.chunkText as string,
      score: 1.0 - (typeof r.distance === 'number' ? r.distance : 0.0),
      source: 'vector' as const,
      createdAt: r.createdAt as number,
      sourceType: r.sourceType as string | undefined,
      sourceId: r.source_id != null ? String(r.source_id) : undefined
    }))

    if (threshold !== undefined) {
      results = results.filter((r) => r.score >= threshold)
    }
    return results
  }

  private async queryWithVectorTopK(
    vectorStr: string,
    limit: number,
    threshold?: number,
    filter?: QueryFilter
  ): Promise<ISearchResult[]> {
    const joinFilter = this.buildJoinAndClause(filter, 'ae.')
    const res = await this.db.execute({
      sql: `
        SELECT ae.embedding_id, ae.source_id AS sourceId, ae.group_id AS sessionId, ae.chunk_text AS chunkText,
               ae.source_created_at AS createdAt, ae.source_type AS sourceType, vt.distance
        FROM vector_top_k('${HYBRID_SEARCH_INDEX_NAME}', vector(?), ?) AS vt
        JOIN ${HYBRID_SEARCH_TABLE} ae ON ae.rowid = vt.id${joinFilter.sql}
      `,
      args: [vectorStr, limit, ...joinFilter.args]
    })

    let results = Array.from(res.rows).map((r) => ({
      messageId: r.embedding_id as string,
      sessionId: r.sessionId as string,
      chunkText: r.chunkText as string,
      score: 1.0 - (typeof r.distance === 'number' ? r.distance : 0.0),
      source: 'vector' as const,
      createdAt: r.createdAt as number,
      sourceType: r.sourceType as string | undefined,
      sourceId: r.sourceId != null ? String(r.sourceId) : undefined
    }))

    if (threshold !== undefined) {
      results = results.filter((r) => r.score >= threshold)
    }
    return results
  }

  private async queryWithJSCosine(
    queryVector: number[],
    limit: number,
    threshold?: number,
    filter?: QueryFilter
  ): Promise<ISearchResult[]> {
    try {
      const where = this.buildWhereClause(filter)
      const res = await this.db.execute({
        sql: `SELECT embedding_id, source_id AS sourceId, group_id AS sessionId, chunk_text AS chunkText,
                source_created_at AS createdAt, source_type AS sourceType,
                hex(embedding) AS embeddingHex
         FROM ${HYBRID_SEARCH_TABLE}${where.sql}`,
        args: where.args
      })

      const dimension = queryVector.length
      let normA = 0
      for (let i = 0; i < dimension; i++) {
        const qv = queryVector[i] ?? 0
        normA += qv * qv
      }
      const sqrtNormA = Math.sqrt(normA)
      const scored: Array<ISearchResult & { _dist: number }> = []

      for (const r of res.rows) {
        try {
          const hexStr = r.embeddingHex as string
          if (!hexStr) continue

          const buffer = hexToBytes(hexStr)
          if (buffer.length < dimension * 4) continue

          const embArr = bytesToFloat32Array(buffer, dimension)

          let dot = 0,
            normB = 0
          for (let i = 0; i < dimension; i++) {
            const ev = embArr[i] ?? 0
            dot += (queryVector[i] ?? 0) * ev
            normB += ev * ev
          }
          const distance =
            sqrtNormA > 0 && normB > 0 ? 1.0 - dot / (sqrtNormA * Math.sqrt(normB)) : 1.0

          scored.push({
            messageId: r.embedding_id as string,
            sessionId: r.sessionId as string,
            chunkText: r.chunkText as string,
            score: 1.0 - distance,
            source: 'vector' as const,
            createdAt: r.createdAt as number,
            sourceType: r.sourceType as string | undefined,
            sourceId: r.sourceId != null ? String(r.sourceId) : undefined,
            _dist: distance
          })
        } catch {
          continue
        }
      }

      scored.sort((a, b) => a._dist - b._dist)
      let results = scored.slice(0, limit).map(({ _dist: _, ...r }) => r)

      if (threshold !== undefined) {
        results = results.filter((r) => r.score >= threshold)
      }
      return results
    } catch (e: any) {
      logger.error('[VectorSearch] JS 余弦降级也失败了:', e.message)
      return []
    }
  }

  async fetchAllEmbeddingsForDecoupledSearch(sessionGroupId?: string): Promise<
    {
      messageId: string
      sessionId: string
      chunkText: string
      embedding: number[]
      createdAt?: number
    }[]
  > {
    let sql = `SELECT embedding_id, group_id AS sessionId, chunk_text AS chunkText,
                      hex(embedding) AS embeddingHex, dimension,
                      source_created_at AS createdAt
               FROM ${HYBRID_SEARCH_TABLE}`
    const args: (string | number)[] = []
    if (sessionGroupId) {
      sql += ` WHERE group_id = ?`
      args.push(sessionGroupId)
    }

    const res = await this.db.execute({ sql, args })
    return Array.from(res.rows).map((r) => {
      let embeddingArr: number[] = []
      try {
        const hexStr = r.embeddingHex as string
        const dimension = Number(r.dimension ?? 0)
        if (hexStr && dimension > 0) {
          const buffer = hexToBytes(hexStr)
          embeddingArr = Array.from(bytesToFloat32Array(buffer, dimension))
        }
      } catch {}
      return {
        messageId: r.embedding_id as string,
        sessionId: r.sessionId as string,
        chunkText: r.chunkText as string,
        embedding: embeddingArr,
        createdAt: r.createdAt as number
      }
    })
  }
}
