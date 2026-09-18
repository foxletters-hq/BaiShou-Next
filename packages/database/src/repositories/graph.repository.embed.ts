import { and, desc, eq, isNull, like, or, sql } from 'drizzle-orm'
import { GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT } from '@baishou/shared'
import { isMissingSqliteFunctionError } from '../utils/sqlite-function-error.util'
import { graphNodesTable } from '../schema/graph'
import type { AppDatabase } from '../types'
import { cosineDistance, mapNode, serializeVector } from './graph.repository.shared'
import type { GraphNodeRow } from './graph.repository.types'

export class GraphEmbedOps {
  constructor(private readonly database: AppDatabase) {}

  async searchNodesByVector(
    vaultId: string,
    vector: number[],
    topK: number,
    opts?: { nodeType?: string; modelId?: string }
  ): Promise<Array<GraphNodeRow & { distance: number }>> {
    const query = new Float32Array(vector)
    const buf = serializeVector(vector)

    try {
      const conditions = [
        eq(graphNodesTable.vaultId, vaultId),
        isNull(graphNodesTable.deletedAt),
        sql`${graphNodesTable.embedding} is not null`,
        eq(graphNodesTable.dimension, query.length)
      ]
      if (opts?.nodeType) conditions.push(eq(graphNodesTable.nodeType, opts.nodeType))
      if (opts?.modelId) conditions.push(eq(graphNodesTable.modelId, opts.modelId))

      const rows = await this.database
        .select({
          row: graphNodesTable,
          distance: sql<number>`vec_distance_cosine(${graphNodesTable.embedding}, ${buf})`.as(
            'distance'
          )
        })
        .from(graphNodesTable)
        .where(and(...conditions))
        .orderBy(sql`vec_distance_cosine(${graphNodesTable.embedding}, ${buf}) ASC`)
        .limit(topK)

      return rows.map((r) => ({ ...mapNode(r.row), distance: Number(r.distance) }))
    } catch (e) {
      if (!isMissingSqliteFunctionError(e)) throw e
    }

    // JS fallback when sqlite-vec is unavailable
    const filters = [
      eq(graphNodesTable.vaultId, vaultId),
      isNull(graphNodesTable.deletedAt),
      ...(opts?.nodeType ? [eq(graphNodesTable.nodeType, opts.nodeType)] : [])
    ]
    const rows = await this.database
      .select()
      .from(graphNodesTable)
      .where(and(...filters))
      .limit(GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT)
    if (rows.length >= GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT) {
      console.warn(
        `[GraphRepository] searchNodesByVector JS fallback scanned ${GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT} rows`
      )
    }
    const scored: Array<GraphNodeRow & { distance: number }> = []
    for (const row of rows) {
      if (!row.embedding || !row.dimension || row.dimension !== query.length) continue
      if (opts?.modelId && row.modelId && row.modelId !== opts.modelId) continue
      const embBuf = row.embedding as Buffer
      const emb = new Float32Array(embBuf.buffer, embBuf.byteOffset, row.dimension)
      scored.push({ ...mapNode(row), distance: cosineDistance(query, emb) })
    }
    scored.sort((a, b) => a.distance - b.distance)
    return scored.slice(0, topK)
  }

  async countUnembeddedLiveNodes(vaultId: string): Promise<number> {
    const rows = await this.database
      .select({ count: sql<number>`count(*)` })
      .from(graphNodesTable)
      .where(
        and(
          eq(graphNodesTable.vaultId, vaultId),
          isNull(graphNodesTable.deletedAt),
          sql`${graphNodesTable.embedding} is null`
        )
      )
    return Number(rows[0]?.count ?? 0)
  }

  async listEmbeddedLiveNodesPage(
    vaultId: string,
    options?: { keyword?: string; limit?: number; offset?: number }
  ): Promise<
    Array<{ id: string; name: string; summary: string; modelId: string; updatedAt: number }>
  > {
    const vid = vaultId.trim()
    if (!vid) return []
    const keyword = options?.keyword?.trim()
    const limit = Math.max(1, options?.limit ?? 10)
    const offset = Math.max(0, options?.offset ?? 0)
    const filters = [
      eq(graphNodesTable.vaultId, vid),
      isNull(graphNodesTable.deletedAt),
      sql`${graphNodesTable.embedding} is not null`
    ]
    if (keyword) {
      filters.push(
        or(
          like(graphNodesTable.name, `%${keyword}%`),
          like(graphNodesTable.summary, `%${keyword}%`)
        )!
      )
    }
    const rows = await this.database
      .select({
        id: graphNodesTable.id,
        name: graphNodesTable.name,
        summary: graphNodesTable.summary,
        modelId: graphNodesTable.modelId,
        updatedAt: graphNodesTable.updatedAt
      })
      .from(graphNodesTable)
      .where(and(...filters))
      .orderBy(desc(graphNodesTable.updatedAt), desc(graphNodesTable.id))
      .limit(limit)
      .offset(offset)
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      summary: row.summary ?? '',
      modelId: row.modelId ?? '',
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.getTime() : Number(row.updatedAt)
    }))
  }

  async countEmbeddedLiveNodes(vaultId: string, keyword?: string): Promise<number> {
    const vid = vaultId.trim()
    if (!vid) return 0
    const trimmed = keyword?.trim()
    const filters = [
      eq(graphNodesTable.vaultId, vid),
      isNull(graphNodesTable.deletedAt),
      sql`${graphNodesTable.embedding} is not null`
    ]
    if (trimmed) {
      filters.push(
        or(
          like(graphNodesTable.name, `%${trimmed}%`),
          like(graphNodesTable.summary, `%${trimmed}%`)
        )!
      )
    }
    const rows = await this.database
      .select({ count: sql<number>`count(*)` })
      .from(graphNodesTable)
      .where(and(...filters))
    return Number(rows[0]?.count ?? 0)
  }

  async clearNodeEmbedding(id: string, vaultId: string): Promise<void> {
    if (!id.trim() || !vaultId.trim()) return
    await this.database
      .update(graphNodesTable)
      .set({
        embedding: null,
        dimension: null,
        modelId: '',
        updatedAt: new Date()
      })
      .where(and(eq(graphNodesTable.id, id), eq(graphNodesTable.vaultId, vaultId)))
  }

  async listUnembeddedLiveNodes(
    vaultId: string
  ): Promise<Array<{ id: string; name: string; summary: string }>> {
    const rows = await this.database
      .select({
        id: graphNodesTable.id,
        name: graphNodesTable.name,
        summary: graphNodesTable.summary
      })
      .from(graphNodesTable)
      .where(
        and(
          eq(graphNodesTable.vaultId, vaultId),
          isNull(graphNodesTable.deletedAt),
          sql`${graphNodesTable.embedding} is null`
        )
      )
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      summary: row.summary ?? ''
    }))
  }

  async updateNodeEmbedding(
    id: string,
    vaultId: string,
    embedding: number[],
    modelId: string
  ): Promise<void> {
    if (!embedding.length) return
    await this.database
      .update(graphNodesTable)
      .set({
        embedding: serializeVector(embedding),
        dimension: embedding.length,
        modelId,
        updatedAt: new Date()
      })
      .where(and(eq(graphNodesTable.id, id), eq(graphNodesTable.vaultId, vaultId)))
  }
}
