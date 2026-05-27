import { ISearchResult, logger } from '@baishou/shared'
import type { ISqlExecutor } from '@baishou/shared'
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

  supportsNativeVectorSearch(): boolean {
    return this.runtime.nativeVectorSupported !== false
  }

  async queryFTS(keyword: string, limit: number): Promise<ISearchResult[]> {
    const res = await this.db.execute({
      sql: `
        SELECT embedding_id, group_id AS sessionId, chunk_text AS chunkText,
               source_created_at AS createdAt
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
      createdAt: r.createdAt as number
    }))
  }

  async queryNativeVector(
    vector: number[],
    limit: number,
    threshold?: number
  ): Promise<ISearchResult[]> {
    const vectorBuffer = Buffer.from(new Float32Array(vector).buffer)
    const vectorStr = `[${vector.join(',')}]`

    if (this.runtime.vecDistanceCosineAvailable !== false) {
      try {
        const results = await this.queryWithVecDistanceCosine(vectorBuffer, limit, threshold)
        this.runtime.vecDistanceCosineAvailable = true
        return results
      } catch (e: any) {
        this.runtime.vecDistanceCosineAvailable = false
        logger.warn(
          '[VectorSearch] vec_distance_cosine not available, falling back to high-fidelity JS Cosine:',
          e.message
        )
      }
    }

    if (this.runtime.vectorTopKAvailable !== false) {
      try {
        const results = await this.queryWithVectorTopK(vectorStr, limit, threshold)
        this.runtime.vectorTopKAvailable = true
        this.runtime.nativeVectorSupported = true
        return results
      } catch (e: any) {
        this.runtime.vectorTopKAvailable = false
        this.runtime.nativeVectorSupported = false
        logger.warn(
          '[VectorSearch] vector_top_k not available, falling back to high-fidelity JS Cosine:',
          e.message
        )
      }
    }

    return this.queryWithJSCosine(vector, limit, threshold)
  }

  private async queryWithVecDistanceCosine(
    vectorBuffer: Buffer,
    limit: number,
    threshold?: number
  ): Promise<ISearchResult[]> {
    const res = await this.db.execute({
      sql: `
        SELECT embedding_id, source_id, group_id AS sessionId, chunk_text AS chunkText,
               source_created_at AS createdAt,
               vec_distance_cosine(embedding, ?) AS distance
        FROM ${HYBRID_SEARCH_TABLE}
        ORDER BY vec_distance_cosine(embedding, ?) ASC
        LIMIT ?
      `,
      args: [vectorBuffer, vectorBuffer, limit]
    })

    let results = Array.from(res.rows).map((r) => ({
      messageId: r.embedding_id as string,
      sessionId: r.sessionId as string,
      chunkText: r.chunkText as string,
      score: 1.0 - (typeof r.distance === 'number' ? r.distance : 0.0),
      source: 'vector' as const,
      createdAt: r.createdAt as number
    }))

    if (threshold !== undefined) {
      results = results.filter((r) => r.score >= threshold)
    }
    return results
  }

  private async queryWithVectorTopK(
    vectorStr: string,
    limit: number,
    threshold?: number
  ): Promise<ISearchResult[]> {
    const res = await this.db.execute({
      sql: `
        SELECT ae.embedding_id, ae.group_id AS sessionId, ae.chunk_text AS chunkText,
               ae.source_created_at AS createdAt, vt.distance
        FROM vector_top_k('${HYBRID_SEARCH_INDEX_NAME}', vector(?), ?) AS vt
        JOIN ${HYBRID_SEARCH_TABLE} ae ON ae.rowid = vt.id
      `,
      args: [vectorStr, limit]
    })

    let results = Array.from(res.rows).map((r) => ({
      messageId: r.embedding_id as string,
      sessionId: r.sessionId as string,
      chunkText: r.chunkText as string,
      score: 1.0 - (typeof r.distance === 'number' ? r.distance : 0.0),
      source: 'vector' as const,
      createdAt: r.createdAt as number
    }))

    if (threshold !== undefined) {
      results = results.filter((r) => r.score >= threshold)
    }
    return results
  }

  private async queryWithJSCosine(
    queryVector: number[],
    limit: number,
    threshold?: number
  ): Promise<ISearchResult[]> {
    try {
      const res = await this.db.execute(
        `SELECT embedding_id, group_id AS sessionId, chunk_text AS chunkText,
                source_created_at AS createdAt,
                hex(embedding) AS embeddingHex
         FROM ${HYBRID_SEARCH_TABLE}`
      )

      const dimension = queryVector.length
      const scored: Array<ISearchResult & { _dist: number }> = []

      for (const r of res.rows) {
        try {
          const hexStr = r.embeddingHex as string
          if (!hexStr) continue

          const buffer = Buffer.from(hexStr, 'hex')
          if (buffer.length < dimension * 4) continue

          const embArr = new Float32Array(buffer.buffer, buffer.byteOffset, dimension)

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
                      hex(embedding) AS embeddingHex,
                      source_created_at AS createdAt
               FROM ${HYBRID_SEARCH_TABLE}`
    const args: any[] = []
    if (sessionGroupId) {
      sql += ` WHERE group_id = ?`
      args.push(sessionGroupId)
    }

    const res = await this.db.execute({ sql, args })
    return Array.from(res.rows).map((r) => {
      let embeddingArr: number[] = []
      try {
        const hexStr = r.embeddingHex as string
        if (hexStr) {
          const buffer = Buffer.from(hexStr, 'hex')
          embeddingArr = Array.from(
            new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4)
          )
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
