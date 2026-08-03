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
  }): Promise<NotebookRow> {
    const now = Date.now()
    await this.db.insert(notebooksTable).values({
      id: input.id,
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

  async listNotebooks(options?: { includeArchived?: boolean }): Promise<NotebookRow[]> {
    if (options?.includeArchived) {
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
    patch: { name?: string; description?: string; archived?: boolean }
  ): Promise<void> {
    const set: Partial<NotebookRow> = { updatedAt: Date.now() }
    if (patch.name !== undefined) set.name = patch.name
    if (patch.description !== undefined) set.description = patch.description
    if (patch.archived !== undefined) set.archived = patch.archived ? 1 : 0
    await this.db.update(notebooksTable).set(set).where(eq(notebooksTable.id, id))
  }

  // ── sources ────────────────────────────────────────────

  async upsertSource(row: {
    id: string
    notebookId: string
    title: string
    sourceKind: string
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
    const existing = await this.getSource(row.id)
    if (existing) {
      await this.db
        .update(knowledgeSourcesTable)
        .set({
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
    await this.db
      .update(knowledgeSourcesTable)
      .set(set)
      .where(eq(knowledgeSourcesTable.id, id))
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
  }): Promise<void> {
    const now = Date.now()
    await this.db
      .insert(knowledgeChunksTable)
      .values({
        chunkId: params.chunkId,
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
    await this.db
      .delete(knowledgeChunksTable)
      .where(eq(knowledgeChunksTable.sourceId, sourceId))
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
    error?: string
  }): Promise<void> {
    const now = Date.now()
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
        attempts: row.attempts + 1
      })
    }
    return claimed
  }

  async completeIngestJob(id: number): Promise<void> {
    await this.db.delete(knowledgeIngestJobsTable).where(eq(knowledgeIngestJobsTable.id, id))
  }

  async failIngestJob(
    id: number,
    error: string,
    options?: { backoffMs?: number }
  ): Promise<void> {
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

  async getStats(notebookId?: string): Promise<{
    notebooks: number
    sources: number
    chunks: number
    pendingJobs: number
  }> {
    const notebooks = notebookId
      ? 1
      : Number(
          (
            await this.db.select({ c: sql<number>`count(*)` }).from(notebooksTable)
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
            await this.db.select({ c: sql<number>`count(*)` }).from(knowledgeSourcesTable)
          )[0]?.c ?? 0
        )
    const chunks = await this.countChunks(notebookId)
    const pendingJobs = await this.countIngestJobs()
    return { notebooks, sources, chunks, pendingJobs }
  }

  /** 暴露底层 job 行（调试） */
  async listIngestJobs(): Promise<KnowledgeIngestJobRow[]> {
    return this.db.select().from(knowledgeIngestJobsTable)
  }
}
