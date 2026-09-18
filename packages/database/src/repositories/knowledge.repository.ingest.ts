import { and, eq, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm'
import { knowledgeIngestJobsTable, type KnowledgeIngestJobRow } from '../schema/knowledge'
import type { AppDatabase } from '../types'
import type { KnowledgeIngestJobStatus, KnowledgeIngestStage } from './knowledge.repository.types'

export class KnowledgeIngestOps {
  constructor(private readonly db: AppDatabase) {}

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
      or(
        isNull(knowledgeIngestJobsTable.nextRetryAt),
        lte(knowledgeIngestJobsTable.nextRetryAt, now)
      )
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

  async deleteIngestJobsForSource(sourceId: string, stage?: KnowledgeIngestStage): Promise<number> {
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

  /** 列出摄入任务；打开笔记本时必须带 notebookId / stage，禁止全表扫。 */
  async listIngestJobs(options?: {
    notebookId?: string
    vaultId?: string
    stage?: KnowledgeIngestStage
  }): Promise<KnowledgeIngestJobRow[]> {
    const notebookId = options?.notebookId?.trim()
    const vaultId = options?.vaultId?.trim()
    const stage = options?.stage
    const filters: SQL[] = []
    if (notebookId) filters.push(eq(knowledgeIngestJobsTable.notebookId, notebookId))
    if (vaultId) filters.push(eq(knowledgeIngestJobsTable.vaultId, vaultId))
    if (stage) filters.push(eq(knowledgeIngestJobsTable.stage, stage))
    if (filters.length === 0) {
      return this.db.select().from(knowledgeIngestJobsTable)
    }
    return this.db
      .select()
      .from(knowledgeIngestJobsTable)
      .where(and(...filters))
  }
}
