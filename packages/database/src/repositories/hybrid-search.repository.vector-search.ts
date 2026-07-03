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

type QueryFilter = Pick<VectorSearchQueryFilter, 'sourceType' | 'startMs' | 'endMs'>
type SqlBindValue = string | number | null | Uint8Array | ArrayBuffer

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
    filter?: Pick<VectorSearchQueryFilter, 'startMs' | 'endMs'>
  ): Promise<ISearchResult[]> {
    const timeWhere = this.buildWhereClause(filter)
    const keywordClause = timeWhere.sql ? ' AND chunk_text LIKE ?' : ' WHERE chunk_text LIKE ?'
    const res = await this.db.execute({
      sql: `
        SELECT embedding_id, source_id AS sourceId, group_id AS sessionId, chunk_text AS chunkText,
               source_created_at AS createdAt, source_type AS sourceType
        FROM ${HYBRID_SEARCH_TABLE}${timeWhere.sql}${keywordClause}
        LIMIT ?
      `,
      args: [...timeWhere.args, `%${keyword}%`, limit]
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
    const vectorStr = `[${vector.join(',')}]`
    const queryFilter: QueryFilter = {
      sourceType: filter?.sourceType,
      startMs: filter?.startMs,
      endMs: filter?.endMs
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
        ORDER BY vec_distance_cosine(embedding, ?) ASC
        LIMIT ?
      `,
      args: [vectorBuffer, ...where.args, vectorBuffer, limit]
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
      const scored: Array<ISearchResult & { _dist: number }> = []

      for (const r of res.rows) {
        try {
          const hexStr = r.embeddingHex as string
          if (!hexStr) continue

          const buffer = hexToBytes(hexStr)
          if (buffer.length < dimension * 4) continue

          const embArr = bytesToFloat32Array(buffer, dimension)

          let dot = 0,
            normA = 0,
            normB = 0
          for (let i = 0; i < dimension; i++) {
            dot += (queryVector[i] ?? 0) * (embArr[i] ?? 0)
            normA += (queryVector[i] ?? 0) * (queryVector[i] ?? 0)
            normB += (embArr[i] ?? 0) * (embArr[i] ?? 0)
          }
          const distance =
            normA > 0 && normB > 0 ? 1.0 - dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 1.0

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
