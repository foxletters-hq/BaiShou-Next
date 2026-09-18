import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  knowledgeChunksTable,
  knowledgeSourcesTable,
  notebooksTable,
  type KnowledgeChunkRow
} from '../schema/knowledge'
import type { AppDatabase } from '../types'
import type { KnowledgeChunkListItem } from './knowledge.repository.types'

export class KnowledgeChunkOps {
  constructor(private readonly db: AppDatabase) {}

  async insertChunk(params: {
    chunkId: string
    notebookId: string
    sourceId: string
    chunkIndex: number
    chunkText: string
    metadataJson?: string
    embedding: Buffer
    dimension: number
    modelId: string
    vaultId: string
  }): Promise<void> {
    const now = Date.now()
    const vaultId = params.vaultId.trim()
    if (!vaultId) throw new Error('insertChunk: vaultId is required')
    await this.db
      .insert(knowledgeChunksTable)
      .values({
        chunkId: params.chunkId,
        vaultId,
        notebookId: params.notebookId,
        sourceId: params.sourceId,
        chunkIndex: params.chunkIndex,
        chunkText: params.chunkText,
        metadataJson: params.metadataJson ?? '{}',
        embedding: params.embedding,
        dimension: params.dimension,
        modelId: params.modelId,
        createdAt: now
      })
      .onConflictDoUpdate({
        target: [knowledgeChunksTable.chunkId],
        set: {
          vaultId,
          chunkText: params.chunkText,
          metadataJson: params.metadataJson ?? '{}',
          embedding: params.embedding,
          dimension: params.dimension,
          modelId: params.modelId,
          chunkIndex: params.chunkIndex,
          notebookId: params.notebookId,
          sourceId: params.sourceId
        }
      })
  }

  async deleteChunksBySource(sourceId: string): Promise<void> {
    await this.db.delete(knowledgeChunksTable).where(eq(knowledgeChunksTable.sourceId, sourceId))
  }

  async deleteChunksByNotebook(notebookId: string): Promise<void> {
    await this.db
      .delete(knowledgeChunksTable)
      .where(eq(knowledgeChunksTable.notebookId, notebookId))
  }

  async countChunks(notebookId?: string): Promise<number> {
    if (notebookId) {
      const rows = await this.db
        .select({ c: sql<number>`count(*)` })
        .from(knowledgeChunksTable)
        .where(eq(knowledgeChunksTable.notebookId, notebookId))
      return Number(rows[0]?.c ?? 0)
    }
    const rows = await this.db.select({ c: sql<number>`count(*)` }).from(knowledgeChunksTable)
    return Number(rows[0]?.c ?? 0)
  }

  async listChunksBySource(sourceId: string): Promise<KnowledgeChunkRow[]> {
    return this.db
      .select()
      .from(knowledgeChunksTable)
      .where(eq(knowledgeChunksTable.sourceId, sourceId))
      .orderBy(knowledgeChunksTable.chunkIndex)
  }

  /**
   * 按笔记本分页列出向量片段。禁止 SELECT *，避免把 embedding BLOB 拉进 UI。
   */
  async listChunksByNotebook(input: {
    notebookId: string
    limit?: number
    offset?: number
    query?: string
  }): Promise<{ items: KnowledgeChunkListItem[]; total: number }> {
    const notebookId = input.notebookId.trim()
    if (!notebookId) throw new Error('listChunksByNotebook: notebookId is required')
    const limit = Math.min(100, Math.max(1, input.limit ?? 20))
    const offset = Math.max(0, input.offset ?? 0)
    const query = input.query?.trim() ?? ''
    const filters = [eq(knowledgeChunksTable.notebookId, notebookId)]
    if (query) {
      const q = `%${query.replace(/[%_]/g, '')}%`
      filters.push(sql`${knowledgeChunksTable.chunkText} LIKE ${q}`)
    }
    const where = and(...filters)

    const countRows = await this.db
      .select({ c: sql<number>`count(*)` })
      .from(knowledgeChunksTable)
      .where(where)
    const total = Number(countRows[0]?.c ?? 0)

    const items = await this.db
      .select({
        chunkId: knowledgeChunksTable.chunkId,
        sourceId: knowledgeChunksTable.sourceId,
        notebookId: knowledgeChunksTable.notebookId,
        chunkIndex: knowledgeChunksTable.chunkIndex,
        chunkText: knowledgeChunksTable.chunkText,
        metadataJson: knowledgeChunksTable.metadataJson,
        dimension: knowledgeChunksTable.dimension,
        modelId: knowledgeChunksTable.modelId,
        createdAt: knowledgeChunksTable.createdAt,
        sourceTitle: knowledgeSourcesTable.title
      })
      .from(knowledgeChunksTable)
      .leftJoin(knowledgeSourcesTable, eq(knowledgeChunksTable.sourceId, knowledgeSourcesTable.id))
      .where(where)
      .orderBy(asc(knowledgeChunksTable.chunkIndex), desc(knowledgeChunksTable.createdAt))
      .limit(limit)
      .offset(offset)

    return { items, total }
  }

  /** 只计行数，禁止为存在性判断拉 embedding BLOB */
  async countChunksBySource(sourceId: string): Promise<number> {
    const rows = await this.db
      .select({ c: sql<number>`count(*)` })
      .from(knowledgeChunksTable)
      .where(eq(knowledgeChunksTable.sourceId, sourceId))
    return Number(rows[0]?.c ?? 0)
  }

  async deleteChunksBySourceFromIndex(sourceId: string, fromIndex: number): Promise<void> {
    await this.db
      .delete(knowledgeChunksTable)
      .where(
        and(
          eq(knowledgeChunksTable.sourceId, sourceId),
          sql`${knowledgeChunksTable.chunkIndex} >= ${fromIndex}`
        )
      )
  }

  /**
   * 库内 source_id（orphan 差集用）。
   * 传入 vaultId 时只看该仓；禁止在多仓全局库上无过滤全扫。
   */
  async listDistinctSourceIds(options?: {
    notebookId?: string
    vaultId?: string
  }): Promise<string[]> {
    const notebookId = options?.notebookId
    const vaultId = options?.vaultId?.trim()

    if (notebookId) {
      const rows = await this.db
        .selectDistinct({ sourceId: knowledgeChunksTable.sourceId })
        .from(knowledgeChunksTable)
        .where(eq(knowledgeChunksTable.notebookId, notebookId))
      const fromChunks = rows.map((r) => r.sourceId)
      const sources = await this.db
        .select({ id: knowledgeSourcesTable.id })
        .from(knowledgeSourcesTable)
        .where(eq(knowledgeSourcesTable.notebookId, notebookId))
      return [...new Set([...fromChunks, ...sources.map((s) => s.id)])]
    }

    if (vaultId) {
      const chunkRows = await this.db
        .selectDistinct({ sourceId: knowledgeChunksTable.sourceId })
        .from(knowledgeChunksTable)
        .where(eq(knowledgeChunksTable.vaultId, vaultId))
      const sourceRows = await this.db
        .select({ id: knowledgeSourcesTable.id })
        .from(knowledgeSourcesTable)
        .where(eq(knowledgeSourcesTable.vaultId, vaultId))
      return [...new Set([...chunkRows.map((r) => r.sourceId), ...sourceRows.map((r) => r.id)])]
    }

    const chunkRows = await this.db
      .selectDistinct({ sourceId: knowledgeChunksTable.sourceId })
      .from(knowledgeChunksTable)
    const sourceRows = await this.db
      .select({ id: knowledgeSourcesTable.id })
      .from(knowledgeSourcesTable)
    return [...new Set([...chunkRows.map((r) => r.sourceId), ...sourceRows.map((r) => r.id)])]
  }

  /**
   * 与当前嵌入模型不一致的 chunk 数（Ask 硬拦截）。
   * 传入 vaultId 时只统计该仓，避免他仓向量误拦当前仓。
   */
  async countHeterogeneousEmbeddings(
    currentModelId: string,
    options?: { vaultId?: string; notebookIds?: string[] }
  ): Promise<number> {
    const modelId = (currentModelId || '').trim()
    if (!modelId) return 0
    const vaultId = options?.vaultId?.trim()
    const notebookIds = (options?.notebookIds ?? []).map((id) => id.trim()).filter(Boolean)
    if (options?.notebookIds && notebookIds.length === 0) return 0
    const filters = [
      sql`${knowledgeChunksTable.modelId} != ''`,
      sql`${knowledgeChunksTable.modelId} != ${modelId}`
    ]
    if (vaultId) filters.push(eq(knowledgeChunksTable.vaultId, vaultId))
    if (notebookIds.length > 0) {
      filters.push(inArray(knowledgeChunksTable.notebookId, notebookIds))
    }
    const rows = await this.db
      .select({ c: sql<number>`count(*)` })
      .from(knowledgeChunksTable)
      .where(and(...filters))
    return Number(rows[0]?.c ?? 0)
  }

  /** 按本聚合维度 / 模型，不读 embedding BLOB。 */
  async listNotebookEmbeddingProfiles(opts: { vaultId?: string; notebookIds: string[] }): Promise<
    Array<{
      notebookId: string
      notebookName: string
      dimension: number
      modelId: string
      chunkCount: number
    }>
  > {
    const notebookIds = [...new Set(opts.notebookIds.map((id) => id.trim()).filter(Boolean))]
    if (notebookIds.length === 0) return []
    const vaultId = opts.vaultId?.trim()
    const filters = [inArray(knowledgeChunksTable.notebookId, notebookIds)]
    if (vaultId) filters.push(eq(knowledgeChunksTable.vaultId, vaultId))

    const rows = await this.db
      .select({
        notebookId: knowledgeChunksTable.notebookId,
        notebookName: notebooksTable.name,
        dimension: knowledgeChunksTable.dimension,
        modelId: knowledgeChunksTable.modelId,
        chunkCount: sql<number>`count(*)`
      })
      .from(knowledgeChunksTable)
      .leftJoin(notebooksTable, eq(notebooksTable.id, knowledgeChunksTable.notebookId))
      .where(and(...filters))
      .groupBy(
        knowledgeChunksTable.notebookId,
        notebooksTable.name,
        knowledgeChunksTable.dimension,
        knowledgeChunksTable.modelId
      )

    return rows.map((row) => ({
      notebookId: String(row.notebookId),
      notebookName: String(row.notebookName ?? '').trim() || String(row.notebookId),
      dimension: Number(row.dimension ?? 0),
      modelId: String(row.modelId ?? ''),
      chunkCount: Number(row.chunkCount ?? 0)
    }))
  }

  /** 简易 LIKE 检索（K1.1 验收用；真 FTS+向量 Ask 在 K1.2） */
  async searchChunksLike(
    notebookId: string,
    query: string,
    limit = 10
  ): Promise<KnowledgeChunkRow[]> {
    const q = `%${query.replace(/%/g, '')}%`
    return this.db
      .select()
      .from(knowledgeChunksTable)
      .where(
        and(
          eq(knowledgeChunksTable.notebookId, notebookId),
          sql`${knowledgeChunksTable.chunkText} LIKE ${q}`
        )
      )
      .limit(limit)
  }
}
