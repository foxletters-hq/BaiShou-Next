import { eq, and, inArray, lte, or, isNull, sql } from 'drizzle-orm'
import { diaryEmbedJobsTable } from './schema/diary-embed-jobs'
import type { AppDatabase } from './types'

export type DiaryEmbedJobStatus = 'pending' | 'running' | 'failed'

export interface DiaryEmbedJobKey {
  vaultName: string
  diaryId: number
  contentHash: string
}

/** Upsert 欠账：同一 vault+diary 只保留一行 */
export async function enqueueDiaryEmbedJob(
  database: AppDatabase,
  job: DiaryEmbedJobKey,
  error?: string
): Promise<void> {
  const now = Date.now()
  const existing = await database
    .select({ id: diaryEmbedJobsTable.id })
    .from(diaryEmbedJobsTable)
    .where(
      and(
        eq(diaryEmbedJobsTable.vaultName, job.vaultName),
        eq(diaryEmbedJobsTable.diaryId, job.diaryId)
      )
    )
    .limit(1)

  if (existing[0]) {
    await database
      .update(diaryEmbedJobsTable)
      .set({
        contentHash: job.contentHash,
        status: error ? 'failed' : 'pending',
        lastError: error ?? null,
        nextRetryAt: null,
        updatedAt: now
      })
      .where(eq(diaryEmbedJobsTable.id, existing[0].id))
    return
  }

  await database.insert(diaryEmbedJobsTable).values({
    vaultName: job.vaultName,
    diaryId: job.diaryId,
    contentHash: job.contentHash,
    status: error ? 'failed' : 'pending',
    attempts: 0,
    lastError: error ?? null,
    nextRetryAt: null,
    updatedAt: now,
    createdAt: now
  })
}

export async function deleteDiaryEmbedJob(
  database: AppDatabase,
  vaultName: string,
  diaryId: number
): Promise<void> {
  await database
    .delete(diaryEmbedJobsTable)
    .where(
      and(eq(diaryEmbedJobsTable.vaultName, vaultName), eq(diaryEmbedJobsTable.diaryId, diaryId))
    )
}

export async function countDiaryEmbedJobs(database: AppDatabase): Promise<number> {
  const rows = await database
    .select({ c: sql<number>`count(*)` })
    .from(diaryEmbedJobsTable)
    .where(inArray(diaryEmbedJobsTable.status, ['pending', 'failed', 'running']))
  return Number(rows[0]?.c ?? 0)
}

/** 取出可执行任务（pending / failed 且已到重试时间） */
export async function claimDiaryEmbedJobs(
  database: AppDatabase,
  limit: number
): Promise<
  Array<{
    id: number
    vaultName: string
    diaryId: number
    contentHash: string
    attempts: number
  }>
> {
  const now = Date.now()
  const candidates = await database
    .select()
    .from(diaryEmbedJobsTable)
    .where(
      and(
        inArray(diaryEmbedJobsTable.status, ['pending', 'failed']),
        or(isNull(diaryEmbedJobsTable.nextRetryAt), lte(diaryEmbedJobsTable.nextRetryAt, now))
      )
    )
    .limit(Math.max(1, limit))

  const claimed: Array<{
    id: number
    vaultName: string
    diaryId: number
    contentHash: string
    attempts: number
  }> = []

  for (const row of candidates) {
    await database
      .update(diaryEmbedJobsTable)
      .set({
        status: 'running',
        attempts: row.attempts + 1,
        updatedAt: now
      })
      .where(eq(diaryEmbedJobsTable.id, row.id))
    claimed.push({
      id: row.id,
      vaultName: row.vaultName,
      diaryId: row.diaryId,
      contentHash: row.contentHash,
      attempts: row.attempts + 1
    })
  }

  return claimed
}

export async function completeDiaryEmbedJob(database: AppDatabase, id: number): Promise<void> {
  await database.delete(diaryEmbedJobsTable).where(eq(diaryEmbedJobsTable.id, id))
}

export async function failDiaryEmbedJob(
  database: AppDatabase,
  id: number,
  error: string,
  options?: { backoffMs?: number }
): Promise<void> {
  const backoffMs = options?.backoffMs ?? 60_000
  const now = Date.now()
  await database
    .update(diaryEmbedJobsTable)
    .set({
      status: 'failed',
      lastError: error.slice(0, 500),
      nextRetryAt: now + backoffMs,
      updatedAt: now
    })
    .where(eq(diaryEmbedJobsTable.id, id))
}
