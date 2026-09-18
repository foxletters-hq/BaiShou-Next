import { and, eq, isNull, sql } from 'drizzle-orm'
import { GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT, logger } from '@baishou/shared'
import { isMissingSqliteFunctionError } from '../utils/sqlite-function-error.util'
import { notebookGraphNodesTable, type NotebookGraphNodeRow } from '../schema/knowledge'
import type { AppDatabase } from '../types'
import {
  cosineDistance,
  omitNodeEmbedding,
  requireNotebookId,
  serializeVector
} from './notebook-graph.repository.shared'

export class NotebookGraphEmbedOps {
  constructor(private readonly db: AppDatabase) {}

  async updateNodeEmbedding(
    id: string,
    vaultId: string,
    notebookId: string,
    embedding: number[],
    modelId: string
  ): Promise<void> {
    if (!embedding.length) return
    const nb = requireNotebookId(notebookId)
    const vid = vaultId.trim()
    if (!id.trim() || !vid) return
    await this.db
      .update(notebookGraphNodesTable)
      .set({
        embedding: serializeVector(embedding),
        dimension: embedding.length,
        modelId,
        updatedAt: Date.now()
      })
      .where(
        and(
          eq(notebookGraphNodesTable.id, id),
          eq(notebookGraphNodesTable.vaultId, vid),
          eq(notebookGraphNodesTable.notebookId, nb),
          isNull(notebookGraphNodesTable.deletedAt)
        )
      )
  }

  async listUnembeddedLiveNodes(
    vaultId: string,
    notebookId?: string
  ): Promise<Array<{ id: string; notebookId: string; name: string; summary: string }>> {
    const vid = vaultId.trim()
    if (!vid) throw new Error('listUnembeddedLiveNodes: vaultId required')
    const filters = [
      eq(notebookGraphNodesTable.vaultId, vid),
      isNull(notebookGraphNodesTable.deletedAt),
      sql`${notebookGraphNodesTable.embedding} is null`
    ]
    const nb = notebookId?.trim()
    if (nb) filters.push(eq(notebookGraphNodesTable.notebookId, nb))
    const rows = await this.db
      .select({
        id: notebookGraphNodesTable.id,
        notebookId: notebookGraphNodesTable.notebookId,
        name: notebookGraphNodesTable.name,
        summary: notebookGraphNodesTable.summary
      })
      .from(notebookGraphNodesTable)
      .where(and(...filters))
    return rows.map((row) => ({
      id: row.id,
      notebookId: row.notebookId,
      name: row.name,
      summary: row.summary ?? ''
    }))
  }

  async searchNodesByVector(
    vaultId: string,
    notebookId: string,
    vector: number[],
    topK: number,
    opts?: { nodeType?: string; modelId?: string }
  ): Promise<Array<Omit<NotebookGraphNodeRow, 'embedding'> & { distance: number }>> {
    const nb = requireNotebookId(notebookId)
    const vid = vaultId.trim()
    if (!vid) throw new Error('searchNodesByVector: vaultId required')
    const query = new Float32Array(vector)
    const buf = serializeVector(vector)

    try {
      const conditions = [
        eq(notebookGraphNodesTable.vaultId, vid),
        eq(notebookGraphNodesTable.notebookId, nb),
        isNull(notebookGraphNodesTable.deletedAt),
        sql`${notebookGraphNodesTable.embedding} is not null`,
        eq(notebookGraphNodesTable.dimension, query.length)
      ]
      if (opts?.nodeType) conditions.push(eq(notebookGraphNodesTable.nodeType, opts.nodeType))
      if (opts?.modelId) conditions.push(eq(notebookGraphNodesTable.modelId, opts.modelId))

      const rows = await this.db
        .select({
          row: notebookGraphNodesTable,
          distance:
            sql<number>`vec_distance_cosine(${notebookGraphNodesTable.embedding}, ${buf})`.as(
              'distance'
            )
        })
        .from(notebookGraphNodesTable)
        .where(and(...conditions))
        .orderBy(sql`vec_distance_cosine(${notebookGraphNodesTable.embedding}, ${buf}) ASC`)
        .limit(topK)

      return rows.map((r) => ({ ...omitNodeEmbedding(r.row), distance: Number(r.distance) }))
    } catch (e) {
      if (!isMissingSqliteFunctionError(e)) throw e
    }

    const filters = [
      eq(notebookGraphNodesTable.vaultId, vid),
      eq(notebookGraphNodesTable.notebookId, nb),
      isNull(notebookGraphNodesTable.deletedAt),
      ...(opts?.nodeType ? [eq(notebookGraphNodesTable.nodeType, opts.nodeType)] : [])
    ]
    const rows = await this.db
      .select()
      .from(notebookGraphNodesTable)
      .where(and(...filters))
      .limit(GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT)
    if (rows.length >= GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT) {
      logger.warn(
        `[NotebookGraphRepository] searchNodesByVector JS fallback scanned ${GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT} rows`
      )
    }
    const scored: Array<Omit<NotebookGraphNodeRow, 'embedding'> & { distance: number }> = []
    for (const row of rows) {
      if (!row.embedding || !row.dimension || row.dimension !== query.length) continue
      if (opts?.modelId && row.modelId && row.modelId !== opts.modelId) continue
      const embBuf = row.embedding as Buffer
      const emb = new Float32Array(embBuf.buffer, embBuf.byteOffset, row.dimension)
      scored.push({ ...omitNodeEmbedding(row), distance: cosineDistance(query, emb) })
    }
    scored.sort((a, b) => a.distance - b.distance)
    return scored.slice(0, topK)
  }

  async clearNodeEmbedding(id: string, vaultId: string, notebookId: string): Promise<void> {
    const nb = requireNotebookId(notebookId)
    if (!id.trim() || !vaultId.trim()) return
    await this.db
      .update(notebookGraphNodesTable)
      .set({
        embedding: null,
        dimension: null,
        modelId: '',
        updatedAt: Date.now()
      })
      .where(
        and(
          eq(notebookGraphNodesTable.id, id),
          eq(notebookGraphNodesTable.vaultId, vaultId.trim()),
          eq(notebookGraphNodesTable.notebookId, nb),
          isNull(notebookGraphNodesTable.deletedAt)
        )
      )
  }
}
