import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import type { AppDatabase } from '../types'
import {
  knowledgeChunksTable,
  knowledgeIngestJobsTable,
  knowledgeSourcesTable,
  notebooksTable,
  type KnowledgeChunkRow,
  type KnowledgeIngestJobRow,
  type KnowledgeSourceRow,
  type NotebookRow
} from '../schema/knowledge'
import type { NotebookGraphWrite } from './notebook-graph.ports'

export type KnowledgeSourceStatus =
  | 'pending'
  | 'extracting'
  | 'needs_ocr'
  | 'partial'
  | 'embedding'
  | 'ready'
  | 'failed'
  | 'stored'

export type KnowledgeIngestStage = 'extract' | 'embed' | 'graph'
export type KnowledgeIngestJobStatus = 'pending' | 'running' | 'failed'

/** 向量页列表项：不返回 embedding BLOB */
export type KnowledgeChunkListItem = {
  chunkId: string
  sourceId: string
  notebookId: string
  chunkIndex: number
  chunkText: string
  metadataJson: string
  dimension: number
  modelId: string
  createdAt: number
  sourceTitle: string | null
}

export class KnowledgeRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly notebookGraphWrite?: NotebookGraphWrite
  ) {}

  private async notebookGraph(): Promise<NotebookGraphWrite> {
    if (this.notebookGraphWrite) return this.notebookGraphWrite
    const { NotebookGraphRepository } = await import('./notebook-graph.repository')
    return new NotebookGraphRepository(this.db)
  }

  // ── notebooks ──────────────────────────────────────────

  async createNotebook(input: {
    id: string
    name: string
    description?: string
    vaultId: string
    sortOrder?: number
    coverTone?: string
    coverIcon?: string
    coverImage?: string
  }): Promise<NotebookRow> {
    const now = Date.now()
    const vaultId = input.vaultId.trim()
    if (!vaultId) throw new Error('createNotebook: vaultId is required')
    await this.db.insert(notebooksTable).values({
      id: input.id,
      vaultId,
      name: input.name,
      description: input.description ?? '',
      archived: 0,
      sortOrder: input.sortOrder ?? 0,
      coverTone: input.coverTone ?? '',
      coverIcon: input.coverIcon ?? '',
      coverImage: input.coverImage ?? '',
      createdAt: now,
      updatedAt: now
    })
    const row = await this.getNotebook(input.id)
    if (!row) throw new Error(`createNotebook: missing row ${input.id}`)
    return row
  }

  async getNotebook(id: string): Promise<NotebookRow | null> {
    const rows = await this.db
      .select()
      .from(notebooksTable)
      .where(eq(notebooksTable.id, id))
      .limit(1)
    return rows[0] ?? null
  }

  async listNotebooks(options?: {
    includeArchived?: boolean
    vaultId?: string
  }): Promise<NotebookRow[]> {
    const vaultId = options?.vaultId?.trim()
    const archivedOk = options?.includeArchived
    if (vaultId && archivedOk) {
      return this.db
        .select()
        .from(notebooksTable)
        .where(eq(notebooksTable.vaultId, vaultId))
        .orderBy(
          asc(notebooksTable.sortOrder),
          desc(notebooksTable.createdAt),
          notebooksTable.id
        )
    }
    if (vaultId) {
      return this.db
        .select()
        .from(notebooksTable)
        .where(and(eq(notebooksTable.vaultId, vaultId), eq(notebooksTable.archived, 0)))
        .orderBy(
          asc(notebooksTable.sortOrder),
          desc(notebooksTable.createdAt),
          notebooksTable.id
        )
    }
    if (archivedOk) {
      return this.db
        .select()
        .from(notebooksTable)
        .orderBy(
          asc(notebooksTable.sortOrder),
          desc(notebooksTable.createdAt),
          notebooksTable.id
        )
    }
    return this.db
      .select()
      .from(notebooksTable)
      .where(eq(notebooksTable.archived, 0))
      .orderBy(
        asc(notebooksTable.sortOrder),
        desc(notebooksTable.createdAt),
        notebooksTable.id
      )
  }

  async updateNotebook(
    id: string,
    patch: {
      name?: string
      description?: string
      archived?: boolean
      vaultId?: string
      sortOrder?: number
      coverTone?: string
      coverIcon?: string
      coverImage?: string
    }
  ): Promise<void> {
    const set: Partial<NotebookRow> = { updatedAt: Date.now() }
    if (patch.name !== undefined) set.name = patch.name
    if (patch.description !== undefined) set.description = patch.description
    if (patch.archived !== undefined) set.archived = patch.archived ? 1 : 0
    if (patch.vaultId !== undefined) set.vaultId = patch.vaultId.trim()
    if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
    if (patch.coverTone !== undefined) set.coverTone = patch.coverTone
    if (patch.coverIcon !== undefined) set.coverIcon = patch.coverIcon
    if (patch.coverImage !== undefined) set.coverImage = patch.coverImage
    await this.db.update(notebooksTable).set(set).where(eq(notebooksTable.id, id))
  }

  // ── sources ────────────────────────────────────────────

  async upsertSource(row: {
    id: string
    notebookId: string
    title: string
    sourceKind: string
    vaultId: string
    relativePath?: string | null
    originUrl?: string | null
    contentHash: string
    extractedTextHash?: string | null
    extractEngine?: string
    pageCount?: number | null
    textPageCount?: number | null
    status: KnowledgeSourceStatus | string
    errorMessage?: string | null
    byteSize?: number
  }): Promise<KnowledgeSourceRow> {
    const now = Date.now()
    const vaultId = row.vaultId.trim()
    if (!vaultId) throw new Error('upsertSource: vaultId is required')
    const existing = await this.getSource(row.id)
    if (existing) {
      await this.db
        .update(knowledgeSourcesTable)
        .set({
          vaultId,
          notebookId: row.notebookId,
          title: row.title,
          sourceKind: row.sourceKind,
          relativePath: row.relativePath ?? existing.relativePath,
          originUrl: row.originUrl ?? existing.originUrl,
          contentHash: row.contentHash,
          extractedTextHash:
            row.extractedTextHash !== undefined
              ? row.extractedTextHash
              : existing.extractedTextHash,
          extractEngine: row.extractEngine ?? existing.extractEngine,
          pageCount: row.pageCount !== undefined ? row.pageCount : existing.pageCount,
          textPageCount:
            row.textPageCount !== undefined ? row.textPageCount : existing.textPageCount,
          status: row.status,
          errorMessage: row.errorMessage !== undefined ? row.errorMessage : existing.errorMessage,
          byteSize: row.byteSize ?? existing.byteSize,
          updatedAt: now
        })
        .where(eq(knowledgeSourcesTable.id, row.id))
    } else {
      await this.db.insert(knowledgeSourcesTable).values({
        id: row.id,
        vaultId,
        notebookId: row.notebookId,
        title: row.title,
        sourceKind: row.sourceKind,
        relativePath: row.relativePath ?? null,
        originUrl: row.originUrl ?? null,
        contentHash: row.contentHash,
        extractedTextHash: row.extractedTextHash ?? null,
        extractEngine: row.extractEngine ?? 'simple',
        pageCount: row.pageCount ?? null,
        textPageCount: row.textPageCount ?? null,
        status: row.status,
        errorMessage: row.errorMessage ?? null,
        byteSize: row.byteSize ?? 0,
        createdAt: now,
        updatedAt: now
      })
    }
    const out = await this.getSource(row.id)
    if (!out) throw new Error(`upsertSource: missing ${row.id}`)
    return out
  }

  async getSource(id: string): Promise<KnowledgeSourceRow | null> {
    const rows = await this.db
      .select()
      .from(knowledgeSourcesTable)
      .where(eq(knowledgeSourcesTable.id, id))
      .limit(1)
    return rows[0] ?? null
  }

  async listSources(notebookId: string): Promise<KnowledgeSourceRow[]> {
    return this.db
      .select()
      .from(knowledgeSourcesTable)
      .where(eq(knowledgeSourcesTable.notebookId, notebookId))
      .orderBy(knowledgeSourcesTable.createdAt, knowledgeSourcesTable.id)
  }

  async updateSourceStatus(
    id: string,
    status: KnowledgeSourceStatus | string,
    patch?: {
      errorMessage?: string | null
      extractedTextHash?: string | null
      pageCount?: number | null
      textPageCount?: number | null
      extractEngine?: string
    }
  ): Promise<void> {
    const set: Record<string, unknown> = {
      status,
      updatedAt: Date.now()
    }
    if (patch && 'errorMessage' in patch) set.errorMessage = patch.errorMessage
    if (patch && 'extractedTextHash' in patch) set.extractedTextHash = patch.extractedTextHash
    if (patch && 'pageCount' in patch) set.pageCount = patch.pageCount
    if (patch && 'textPageCount' in patch) set.textPageCount = patch.textPageCount
    if (patch && 'extractEngine' in patch) set.extractEngine = patch.extractEngine
    await this.db.update(knowledgeSourcesTable).set(set).where(eq(knowledgeSourcesTable.id, id))
  }

  // ── chunks ─────────────────────────────────────────────

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
      .leftJoin(
        knowledgeSourcesTable,
        eq(knowledgeChunksTable.sourceId, knowledgeSourcesTable.id)
      )
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
      const sources = await this.listSources(notebookId)
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
    options?: { vaultId?: string }
  ): Promise<number> {
    const modelId = (currentModelId || '').trim()
    if (!modelId) return 0
    const vaultId = options?.vaultId?.trim()
    const rows = vaultId
      ? await this.db
          .select({ c: sql<number>`count(*)` })
          .from(knowledgeChunksTable)
          .where(
            and(
              eq(knowledgeChunksTable.vaultId, vaultId),
              sql`${knowledgeChunksTable.modelId} != ''`,
              sql`${knowledgeChunksTable.modelId} != ${modelId}`
            )
          )
      : await this.db
          .select({ c: sql<number>`count(*)` })
          .from(knowledgeChunksTable)
          .where(
            and(
              sql`${knowledgeChunksTable.modelId} != ''`,
              sql`${knowledgeChunksTable.modelId} != ${modelId}`
            )
          )
    return Number(rows[0]?.c ?? 0)
  }

  async deleteSource(sourceId: string): Promise<void> {
    await this.deleteChunksBySource(sourceId)
    await this.db
      .delete(knowledgeIngestJobsTable)
      .where(eq(knowledgeIngestJobsTable.sourceId, sourceId))
    const source = await this.getSource(sourceId)
    await this.db.delete(knowledgeSourcesTable).where(eq(knowledgeSourcesTable.id, sourceId))
    if (source?.notebookId) {
      const { notebookGraphSourceNodeId } = await import('@baishou/shared')
      const graph = await this.notebookGraph()
      await graph.deleteEdgesBySourcePrefix(source.notebookId, sourceId)
      if (source.vaultId?.trim()) {
        await graph.softDeleteNode(
          notebookGraphSourceNodeId(source.vaultId, source.notebookId, sourceId),
          source.notebookId
        )
      }
    }
  }

  async deleteNotebook(notebookId: string): Promise<void> {
    await this.deleteChunksByNotebook(notebookId)
    await this.db
      .delete(knowledgeIngestJobsTable)
      .where(eq(knowledgeIngestJobsTable.notebookId, notebookId))
    await this.db
      .delete(knowledgeSourcesTable)
      .where(eq(knowledgeSourcesTable.notebookId, notebookId))
    await (await this.notebookGraph()).deleteAllForNotebook(notebookId)
    await this.db.delete(notebooksTable).where(eq(notebooksTable.id, notebookId))
  }

  /** 按 vault 清知识库派生数据（删仓时调用） */
  async deleteAllForVault(vaultId: string): Promise<{
    notebooks: number
    sources: number
    chunks: number
    jobs: number
  }> {
    const id = vaultId.trim()
    if (!id) throw new Error('deleteAllForVault: vaultId is required')

    const countWhere = async (run: () => Promise<Array<{ c: number }>>): Promise<number> => {
      const rows = await run()
      return Number(rows[0]?.c ?? 0)
    }

    const notebooks = await countWhere(() =>
      this.db
        .select({ c: sql<number>`count(*)` })
        .from(notebooksTable)
        .where(eq(notebooksTable.vaultId, id))
    )
    const sources = await countWhere(() =>
      this.db
        .select({ c: sql<number>`count(*)` })
        .from(knowledgeSourcesTable)
        .where(eq(knowledgeSourcesTable.vaultId, id))
    )
    const chunks = await countWhere(() =>
      this.db
        .select({ c: sql<number>`count(*)` })
        .from(knowledgeChunksTable)
        .where(eq(knowledgeChunksTable.vaultId, id))
    )
    const jobs = await countWhere(() =>
      this.db
        .select({ c: sql<number>`count(*)` })
        .from(knowledgeIngestJobsTable)
        .where(eq(knowledgeIngestJobsTable.vaultId, id))
    )

    await (await this.notebookGraph()).deleteAllForVault(id)
    await this.db.delete(knowledgeIngestJobsTable).where(eq(knowledgeIngestJobsTable.vaultId, id))
    await this.db.delete(knowledgeChunksTable).where(eq(knowledgeChunksTable.vaultId, id))
    await this.db.delete(knowledgeSourcesTable).where(eq(knowledgeSourcesTable.vaultId, id))
    await this.db.delete(notebooksTable).where(eq(notebooksTable.vaultId, id))

    return { notebooks, sources, chunks, jobs }
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

  // ── ingest jobs ────────────────────────────────────────

  async enqueueIngestJob(job: {
    notebookId: string
    sourceId: string
    stage: KnowledgeIngestStage
    vaultId: string
    error?: string
  }): Promise<void> {
    const now = Date.now()
    const vaultId = job.vaultId.trim()
    if (!vaultId) throw new Error('enqueueIngestJob: vaultId is required')
    const existing = await this.db
      .select({
        id: knowledgeIngestJobsTable.id,
        status: knowledgeIngestJobsTable.status
      })
      .from(knowledgeIngestJobsTable)
      .where(
        and(
          eq(knowledgeIngestJobsTable.sourceId, job.sourceId),
          eq(knowledgeIngestJobsTable.stage, job.stage)
        )
      )
      .limit(1)

    if (existing[0]) {
      if (existing[0].status === 'running' && !job.error) {
        return
      }
      await this.db
        .update(knowledgeIngestJobsTable)
        .set({
          vaultId,
          notebookId: job.notebookId,
          status: job.error ? 'failed' : 'pending',
          lastError: job.error ?? null,
          nextRetryAt: null,
          updatedAt: now
        })
        .where(eq(knowledgeIngestJobsTable.id, existing[0].id))
      return
    }

    await this.db.insert(knowledgeIngestJobsTable).values({
      vaultId,
      notebookId: job.notebookId,
      sourceId: job.sourceId,
      stage: job.stage,
      status: job.error ? 'failed' : 'pending',
      attempts: 0,
      lastError: job.error ?? null,
      nextRetryAt: null,
      createdAt: now,
      updatedAt: now
    })
  }

  async countIngestJobs(options?: {
    notebookId?: string
    vaultId?: string
    stages?: KnowledgeIngestStage[]
    /** 只计可领取（pending/failed 且已到重试时间），不含 running */
    claimableOnly?: boolean
  }): Promise<number> {
    const notebookId = options?.notebookId?.trim()
    const vaultId = options?.vaultId?.trim()
    const stages = options?.stages?.filter(Boolean)
    const now = Date.now()
    const filters = options?.claimableOnly
      ? [
          inArray(knowledgeIngestJobsTable.status, ['pending', 'failed']),
          or(
            isNull(knowledgeIngestJobsTable.nextRetryAt),
            lte(knowledgeIngestJobsTable.nextRetryAt, now)
          )
        ]
      : [inArray(knowledgeIngestJobsTable.status, ['pending', 'failed', 'running'])]
    if (notebookId) filters.push(eq(knowledgeIngestJobsTable.notebookId, notebookId))
    if (vaultId) filters.push(eq(knowledgeIngestJobsTable.vaultId, vaultId))
    if (stages?.length) filters.push(inArray(knowledgeIngestJobsTable.stage, stages))
    const rows = await this.db
      .select({ c: sql<number>`count(*)` })
      .from(knowledgeIngestJobsTable)
      .where(and(...filters))
    return Number(rows[0]?.c ?? 0)
  }

  async claimIngestJobs(
    limit: number,
    options?: { vaultId?: string; stages?: KnowledgeIngestStage[] }
  ): Promise<
    Array<{
      id: number
      notebookId: string
      sourceId: string
      stage: KnowledgeIngestStage
      attempts: number
      vaultId: string
    }>
  > {
    const now = Date.now()
    const vaultId = options?.vaultId?.trim()
    const stages = options?.stages?.filter(Boolean)
    const filters = [
      inArray(knowledgeIngestJobsTable.status, ['pending', 'failed']),
      or(isNull(knowledgeIngestJobsTable.nextRetryAt), lte(knowledgeIngestJobsTable.nextRetryAt, now))
    ]
    if (vaultId) filters.push(eq(knowledgeIngestJobsTable.vaultId, vaultId))
    if (stages?.length) filters.push(inArray(knowledgeIngestJobsTable.stage, stages))

    const candidates = await this.db
      .select()
      .from(knowledgeIngestJobsTable)
      .where(and(...filters))
      .orderBy(knowledgeIngestJobsTable.createdAt, knowledgeIngestJobsTable.id)
      .limit(Math.max(1, limit))

    const claimed: Array<{
      id: number
      notebookId: string
      sourceId: string
      stage: KnowledgeIngestStage
      attempts: number
      vaultId: string
    }> = []

    for (const row of candidates) {
      const updated = await this.db
        .update(knowledgeIngestJobsTable)
        .set({
          status: 'running',
          attempts: row.attempts + 1,
          updatedAt: now
        })
        .where(
          and(
            eq(knowledgeIngestJobsTable.id, row.id),
            inArray(knowledgeIngestJobsTable.status, ['pending', 'failed'])
          )
        )
        .returning({ id: knowledgeIngestJobsTable.id })
      if (!updated[0]) continue
      claimed.push({
        id: row.id,
        notebookId: row.notebookId,
        sourceId: row.sourceId,
        stage: row.stage as KnowledgeIngestStage,
        attempts: row.attempts + 1,
        vaultId: row.vaultId
      })
    }
    return claimed
  }

  async completeIngestJob(id: number): Promise<void> {
    await this.db.delete(knowledgeIngestJobsTable).where(eq(knowledgeIngestJobsTable.id, id))
  }

  /** 仅回收超时的 running（lease）；进行中的 job 靠 live guard / updatedAt 续约 */
  async reclaimStaleRunningIngestJobs(options?: {
    olderThanMs?: number
    vaultId?: string
    excludeSourceIds?: string[]
  }): Promise<number> {
    const now = Date.now()
    const olderThanMs = options?.olderThanMs ?? 15 * 60_000
    const cutoff = now - olderThanMs
    const vaultId = options?.vaultId?.trim()
    const filters = [
      eq(knowledgeIngestJobsTable.status, 'running'),
      lte(knowledgeIngestJobsTable.updatedAt, cutoff)
    ]
    if (vaultId) filters.push(eq(knowledgeIngestJobsTable.vaultId, vaultId))
    const exclude = new Set((options?.excludeSourceIds ?? []).filter(Boolean))
    const rows = await this.db
      .select({
        id: knowledgeIngestJobsTable.id,
        sourceId: knowledgeIngestJobsTable.sourceId
      })
      .from(knowledgeIngestJobsTable)
      .where(and(...filters))
    let reclaimed = 0
    for (const row of rows) {
      if (exclude.has(row.sourceId)) continue
      const updated = await this.db
        .update(knowledgeIngestJobsTable)
        .set({
          status: 'pending',
          nextRetryAt: null,
          updatedAt: now
        })
        .where(
          and(
            eq(knowledgeIngestJobsTable.id, row.id),
            eq(knowledgeIngestJobsTable.status, 'running')
          )
        )
        .returning({ id: knowledgeIngestJobsTable.id })
      if (updated[0]) reclaimed += 1
    }
    return reclaimed
  }

  /** @deprecated 使用 reclaimStaleRunningIngestJobs；全量回收会踩正在跑的 worker */
  async reclaimRunningIngestJobs(): Promise<number> {
    return this.reclaimStaleRunningIngestJobs({ olderThanMs: 0 })
  }

  async listIngestJobsByStatus(
    status: KnowledgeIngestJobStatus,
    options?: { vaultId?: string }
  ): Promise<KnowledgeIngestJobRow[]> {
    const vaultId = options?.vaultId?.trim()
    const filters = [eq(knowledgeIngestJobsTable.status, status)]
    if (vaultId) filters.push(eq(knowledgeIngestJobsTable.vaultId, vaultId))
    return this.db
      .select()
      .from(knowledgeIngestJobsTable)
      .where(and(...filters))
  }

  async listIngestJobsBySource(sourceId: string): Promise<KnowledgeIngestJobRow[]> {
    return this.db
      .select()
      .from(knowledgeIngestJobsTable)
      .where(eq(knowledgeIngestJobsTable.sourceId, sourceId))
  }

  async listSourcesByStatus(
    status: KnowledgeSourceStatus | string,
    options?: { vaultId?: string }
  ): Promise<KnowledgeSourceRow[]> {
    const vaultId = options?.vaultId?.trim()
    const filters = [eq(knowledgeSourcesTable.status, status)]
    if (vaultId) filters.push(eq(knowledgeSourcesTable.vaultId, vaultId))
    return this.db
      .select()
      .from(knowledgeSourcesTable)
      .where(and(...filters))
  }

  async deleteIngestJobsForSource(
    sourceId: string,
    stage?: KnowledgeIngestStage
  ): Promise<number> {
    const before = await this.db
      .select({ id: knowledgeIngestJobsTable.id })
      .from(knowledgeIngestJobsTable)
      .where(
        stage
          ? and(
              eq(knowledgeIngestJobsTable.sourceId, sourceId),
              eq(knowledgeIngestJobsTable.stage, stage)
            )
          : eq(knowledgeIngestJobsTable.sourceId, sourceId)
      )
    if (before.length === 0) return 0
    await this.db
      .delete(knowledgeIngestJobsTable)
      .where(
        stage
          ? and(
              eq(knowledgeIngestJobsTable.sourceId, sourceId),
              eq(knowledgeIngestJobsTable.stage, stage)
            )
          : eq(knowledgeIngestJobsTable.sourceId, sourceId)
      )
    return before.length
  }

  async failIngestJob(id: number, error: string, options?: { backoffMs?: number }): Promise<void> {
    const backoffMs = options?.backoffMs ?? 60_000
    const now = Date.now()
    await this.db
      .update(knowledgeIngestJobsTable)
      .set({
        status: 'failed',
        lastError: error.slice(0, 500),
        nextRetryAt: now + backoffMs,
        updatedAt: now
      })
      .where(eq(knowledgeIngestJobsTable.id, id))
  }

  async getStats(
    notebookId?: string,
    vaultId?: string
  ): Promise<{
    notebooks: number
    sources: number
    chunks: number
    pendingJobs: number
    /** 原文合计（knowledge_sources.byte_size） */
    originalBytes: number
    /** 本笔记本/库估算占用：原文 + 提取正文长度 + 向量 blob */
    totalBytes: number
  }> {
    const vid = vaultId?.trim()
    const notebooks = notebookId
      ? 1
      : Number(
          (
            await (vid
              ? this.db
                  .select({ c: sql<number>`count(*)` })
                  .from(notebooksTable)
                  .where(eq(notebooksTable.vaultId, vid))
              : this.db.select({ c: sql<number>`count(*)` }).from(notebooksTable))
          )[0]?.c ?? 0
        )
    const sources = notebookId
      ? Number(
          (
            await this.db
              .select({ c: sql<number>`count(*)` })
              .from(knowledgeSourcesTable)
              .where(eq(knowledgeSourcesTable.notebookId, notebookId))
          )[0]?.c ?? 0
        )
      : Number(
          (
            await (vid
              ? this.db
                  .select({ c: sql<number>`count(*)` })
                  .from(knowledgeSourcesTable)
                  .where(eq(knowledgeSourcesTable.vaultId, vid))
              : this.db.select({ c: sql<number>`count(*)` }).from(knowledgeSourcesTable))
          )[0]?.c ?? 0
        )
    const chunks = notebookId
      ? await this.countChunks(notebookId)
      : Number(
          (
            await (vid
              ? this.db
                  .select({ c: sql<number>`count(*)` })
                  .from(knowledgeChunksTable)
                  .where(eq(knowledgeChunksTable.vaultId, vid))
              : this.db.select({ c: sql<number>`count(*)` }).from(knowledgeChunksTable))
          )[0]?.c ?? 0
        )
    const pendingJobs = await this.countIngestJobs({
      notebookId,
      vaultId: vid
    })

    const originalRows = notebookId
      ? await this.db
          .select({
            c: sql<number>`coalesce(sum(${knowledgeSourcesTable.byteSize}), 0)`
          })
          .from(knowledgeSourcesTable)
          .where(eq(knowledgeSourcesTable.notebookId, notebookId))
      : vid
        ? await this.db
            .select({
              c: sql<number>`coalesce(sum(${knowledgeSourcesTable.byteSize}), 0)`
            })
            .from(knowledgeSourcesTable)
            .where(eq(knowledgeSourcesTable.vaultId, vid))
        : await this.db
            .select({
              c: sql<number>`coalesce(sum(${knowledgeSourcesTable.byteSize}), 0)`
            })
            .from(knowledgeSourcesTable)
    const originalBytes = Number(originalRows[0]?.c ?? 0)

    const derivedRows = notebookId
      ? await this.db
          .select({
            c: sql<number>`coalesce(sum(length(${knowledgeChunksTable.chunkText})), 0)`
          })
          .from(knowledgeChunksTable)
          .where(eq(knowledgeChunksTable.notebookId, notebookId))
      : vid
        ? await this.db
            .select({
              c: sql<number>`coalesce(sum(length(${knowledgeChunksTable.chunkText})), 0)`
            })
            .from(knowledgeChunksTable)
            .where(eq(knowledgeChunksTable.vaultId, vid))
        : await this.db
            .select({
              c: sql<number>`coalesce(sum(length(${knowledgeChunksTable.chunkText})), 0)`
            })
            .from(knowledgeChunksTable)
    const derivedBytes = Number(derivedRows[0]?.c ?? 0)
    const totalBytes = originalBytes + derivedBytes

    return { notebooks, sources, chunks, pendingJobs, originalBytes, totalBytes }
  }

  /** 列表用：一次按 notebook 聚合，不扫 embedding BLOB */
  async listNotebookStats(vaultId: string): Promise<
    Array<{
      notebookId: string
      sources: number
      chunks: number
      pendingJobs: number
      originalBytes: number
      totalBytes: number
    }>
  > {
    const vid = vaultId.trim()
    if (!vid) throw new Error('listNotebookStats: vaultId is required')

    const sourceRows = await this.db
      .select({
        notebookId: knowledgeSourcesTable.notebookId,
        sources: sql<number>`count(*)`,
        originalBytes: sql<number>`coalesce(sum(${knowledgeSourcesTable.byteSize}), 0)`
      })
      .from(knowledgeSourcesTable)
      .where(eq(knowledgeSourcesTable.vaultId, vid))
      .groupBy(knowledgeSourcesTable.notebookId)

    const chunkRows = await this.db
      .select({
        notebookId: knowledgeChunksTable.notebookId,
        chunks: sql<number>`count(*)`
      })
      .from(knowledgeChunksTable)
      .where(eq(knowledgeChunksTable.vaultId, vid))
      .groupBy(knowledgeChunksTable.notebookId)

    const jobRows = await this.db
      .select({
        notebookId: knowledgeIngestJobsTable.notebookId,
        pendingJobs: sql<number>`count(*)`
      })
      .from(knowledgeIngestJobsTable)
      .where(
        and(
          eq(knowledgeIngestJobsTable.vaultId, vid),
          inArray(knowledgeIngestJobsTable.status, ['pending', 'failed', 'running'])
        )
      )
      .groupBy(knowledgeIngestJobsTable.notebookId)

    const byId = new Map<
      string,
      {
        notebookId: string
        sources: number
        chunks: number
        pendingJobs: number
        originalBytes: number
        totalBytes: number
      }
    >()
    const ensure = (notebookId: string) => {
      let row = byId.get(notebookId)
      if (!row) {
        row = {
          notebookId,
          sources: 0,
          chunks: 0,
          pendingJobs: 0,
          originalBytes: 0,
          totalBytes: 0
        }
        byId.set(notebookId, row)
      }
      return row
    }
    for (const r of sourceRows) {
      const row = ensure(r.notebookId)
      row.sources = Number(r.sources ?? 0)
      row.originalBytes = Number(r.originalBytes ?? 0)
      row.totalBytes = row.originalBytes
    }
    for (const r of chunkRows) {
      ensure(r.notebookId).chunks = Number(r.chunks ?? 0)
    }
    for (const r of jobRows) {
      ensure(r.notebookId).pendingJobs = Number(r.pendingJobs ?? 0)
    }
    return [...byId.values()]
  }

  /** 暴露底层 job 行（调试） */
  async listIngestJobs(): Promise<KnowledgeIngestJobRow[]> {
    return this.db.select().from(knowledgeIngestJobsTable)
  }
}
