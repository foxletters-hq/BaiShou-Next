import {
  bytesToFloat32Array,
  embeddingVectorToBytes,
  hexToBytes,
  ISearchResult,
  logger
} from '@baishou/shared'
import type { ISqlExecutor } from '@baishou/shared'
import { isMissingSqliteFunctionError } from '../utils/sqlite-function-error.util'
import {
  HYBRID_SEARCH_INDEX_NAME,
  HYBRID_SEARCH_TABLE,
  type HybridSearchRuntimeState
} from './hybrid-search.repository.constants'

export class HybridSearchVectorQuery {
  constructor(
    private readonly db: ISqlExecutor,
    private readonly runtime: HybridSearchRuntimeState
  ) {}

  /** 是否已确认 sqlite-vec / libsql 原生向量函数可用（不含 JS 降级）。 */
  supportsNativeVectorSearch(): boolean {
    return this.runtime.nativeVectorSupported === true
  }

  async queryFTS(keyword: string, limit: number): Promise<ISearchResult[]> {
    const res = await this.db.execute({
      sql: `
        SELECT embedding_id, source_id AS sourceId, group_id AS sessionId, chunk_text AS chunkText,
               source_created_at AS createdAt, source_type AS sourceType
        FROM ${HYBRID_SEARCH_TABLE}
        WHERE chunk_text LIKE ?
        LIMIT ?
      `,
      args: [`%${keyword}%`, limit]
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
    threshold?: number,
    sourceType?: string
  ): Promise<ISearchResult[]> {
    const vectorBuffer = embeddingVectorToBytes(vector)
    const vectorStr = `[${vector.join(',')}]`

    if (this.runtime.vecDistanceCosineAvailable !== false) {
      try {
        const results = await this.queryWithVecDistanceCosine(
          vectorBuffer,
          limit,
          threshold,
          sourceType
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
        const results = await this.queryWithVectorTopK(vectorStr, limit, threshold, sourceType)
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

    return this.queryWithJSCosine(vector, limit, threshold, sourceType)
  }

  private sourceTypeClause(sourceType?: string): { sql: string; args: string[] } {
    if (!sourceType) return { sql: '', args: [] }
    return { sql: ` WHERE source_type = ?`, args: [sourceType] }
  }

  private async queryWithVecDistanceCosine(
    vectorBuffer: Uint8Array,
    limit: number,
    threshold?: number,
    sourceType?: string
  ): Promise<ISearchResult[]> {
    const typeFilter = this.sourceTypeClause(sourceType)
    const res = await this.db.execute({
      sql: `
        SELECT embedding_id, source_id, group_id AS sessionId, chunk_text AS chunkText,
               source_created_at AS createdAt, source_type AS sourceType,
               vec_distance_cosine(embedding, ?) AS distance
        FROM ${HYBRID_SEARCH_TABLE}${typeFilter.sql}
        ORDER BY vec_distance_cosine(embedding, ?) ASC
        LIMIT ?
      `,
      args: [vectorBuffer, ...typeFilter.args, vectorBuffer, limit]
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
    sourceType?: string
  ): Promise<ISearchResult[]> {
    const joinFilter = sourceType ? ` AND ae.source_type = ?` : ''
    const res = await this.db.execute({
      sql: `
        SELECT ae.embedding_id, ae.source_id AS sourceId, ae.group_id AS sessionId, ae.chunk_text AS chunkText,
               ae.source_created_at AS createdAt, ae.source_type AS sourceType, vt.distance
        FROM vector_top_k('${HYBRID_SEARCH_INDEX_NAME}', vector(?), ?) AS vt
        JOIN ${HYBRID_SEARCH_TABLE} ae ON ae.rowid = vt.id${joinFilter}
      `,
      args: sourceType ? [vectorStr, limit, sourceType] : [vectorStr, limit]
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
    sourceType?: string
  ): Promise<ISearchResult[]> {
    try {
      const typeFilter = this.sourceTypeClause(sourceType)
      const res = await this.db.execute({
        sql: `SELECT embedding_id, source_id AS sourceId, group_id AS sessionId, chunk_text AS chunkText,
                source_created_at AS createdAt, source_type AS sourceType,
                hex(embedding) AS embeddingHex
         FROM ${HYBRID_SEARCH_TABLE}${typeFilter.sql}`,
        args: typeFilter.args
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
