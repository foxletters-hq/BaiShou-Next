import { and, eq, inArray, sql } from 'drizzle-orm'
import {
  knowledgeChunksTable,
  knowledgeIngestJobsTable,
  knowledgeSourcesTable,
  notebooksTable
} from '../schema/knowledge'
import type { AppDatabase } from '../types'
import type { KnowledgeChunkOps } from './knowledge.repository.chunk'
import type { KnowledgeIngestOps } from './knowledge.repository.ingest'

export class KnowledgeStatsOps {
  constructor(
    private readonly db: AppDatabase,
    private readonly chunks: KnowledgeChunkOps,
    private readonly ingest: KnowledgeIngestOps
  ) {}

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
      ? await this.chunks.countChunks(notebookId)
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
    const pendingJobs = await this.ingest.countIngestJobs({
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
}
