import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'
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

export type KnowledgeSourceStatus =
  | 'pending'
  | 'extracting'
  | 'needs_ocr'
  | 'partial'
  | 'embedding'
  | 'ready'
  | 'failed'

export type KnowledgeIngestStage = 'extract' | 'embed'
export type KnowledgeIngestJobStatus = 'pending' | 'running' | 'failed'

export class KnowledgeRepository {
  constructor(private readonly db: AppDatabase) {}

  // ── notebooks ──────────────────────────────────────────

  async createNotebook(input: {
    id: string
    name: string
    description?: string
    vaultId: string
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
        .orderBy(notebooksTable.updatedAt)
    }
    if (vaultId) {
      return this.db
        .select()
        .from(notebooksTable)
        .where(and(eq(notebooksTable.vaultId, vaultId), eq(notebooksTable.archived, 0)))
        .orderBy(notebooksTable.updatedAt)
    }
    if (archivedOk) {
      return this.db.select().from(notebooksTable).orderBy(notebooksTable.updatedAt)
    }
    return this.db
      .select()
      .from(notebooksTable)
      .where(eq(notebooksTable.archived, 0))
      .orderBy(notebooksTable.updatedAt)
  }

  async updateNotebook(
    id: string,
    patch: { name?: string; description?: string; archived?: boolean; vaultId?: string }
  ): Promise<void> {
    const set: Partial<NotebookRow> = { updatedAt: Date.now() }
    if (patch.name !== undefined) set.name = patch.name
    if (patch.description !== undefined) set.description = patch.description
    if (patch.archived !== undefined) set.archived = patch.archived ? 1 : 0
    if (patch.vaultId !== undefined) set.vaultId = patch.vaultId.trim()
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
      .orderBy(knowledgeSourcesTable.createdAt)
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
    await this.db.delete(knowledgeSourcesTable).where(eq(knowledgeSourcesTable.id, sourceId))
  }

  async deleteNotebook(notebookId: string): Promise<void> {
    await this.deleteChunksByNotebook(notebookId)
    await this.db
      .delete(knowledgeIngestJobsTable)
      .where(eq(knowledgeIngestJobsTable.notebookId, notebookId))
    await this.db
      .delete(knowledgeSourcesTable)
      .where(eq(knowledgeSourcesTable.notebookId, notebookId))
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
      .select({ id: knowledgeIngestJobsTable.id })
      .from(knowledgeIngestJobsTable)
      .where(
        and(
          eq(knowledgeIngestJobsTable.sourceId, job.sourceId),
          eq(knowledgeIngestJobsTable.stage, job.stage)
        )
      )
      .limit(1)

    if (existing[0]) {
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

  async countIngestJobs(): Promise<number> {
    const rows = await this.db
      .select({ c: sql<number>`count(*)` })
      .from(knowledgeIngestJobsTable)
      .where(inArray(knowledgeIngestJobsTable.status, ['pending', 'failed', 'running']))
    return Number(rows[0]?.c ?? 0)
  }

  async claimIngestJobs(limit: number): Promise<
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
    const candidates = await this.db
      .select()
      .from(knowledgeIngestJobsTable)
      .where(
        and(
          inArray(knowledgeIngestJobsTable.status, ['pending', 'failed']),
          or(
            isNull(knowledgeIngestJobsTable.nextRetryAt),
            lte(knowledgeIngestJobsTable.nextRetryAt, now)
          )
        )
      )
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
      await this.db
        .update(knowledgeIngestJobsTable)
        .set({
          status: 'running',
          attempts: row.attempts + 1,
          updatedAt: now
        })
        .where(eq(knowledgeIngestJobsTable.id, row.id))
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
    const pendingJobs = await this.countIngestJobs()

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
            c: sql<number>`coalesce(sum(length(${knowledgeChunksTable.chunkText}) + length(${knowledgeChunksTable.embedding})), 0)`
          })
          .from(knowledgeChunksTable)
          .where(eq(knowledgeChunksTable.notebookId, notebookId))
      : vid
        ? await this.db
            .select({
              c: sql<number>`coalesce(sum(length(${knowledgeChunksTable.chunkText}) + length(${knowledgeChunksTable.embedding})), 0)`
            })
            .from(knowledgeChunksTable)
            .where(eq(knowledgeChunksTable.vaultId, vid))
        : await this.db
            .select({
              c: sql<number>`coalesce(sum(length(${knowledgeChunksTable.chunkText}) + length(${knowledgeChunksTable.embedding})), 0)`
            })
            .from(knowledgeChunksTable)
    const derivedBytes = Number(derivedRows[0]?.c ?? 0)
    const totalBytes = originalBytes + derivedBytes

    return { notebooks, sources, chunks, pendingJobs, originalBytes, totalBytes }
  }

  /** 暴露底层 job 行（调试） */
  async listIngestJobs(): Promise<KnowledgeIngestJobRow[]> {
    return this.db.select().from(knowledgeIngestJobsTable)
  }
}
