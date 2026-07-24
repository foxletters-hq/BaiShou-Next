import {
  claimDiaryEmbedJobs as claimJobs,
  completeDiaryEmbedJob as completeJob,
  countDiaryEmbedJobs as countJobs,
  deleteDiaryEmbedJob as deleteJob,
  enqueueDiaryEmbedJob as enqueueJob,
  failDiaryEmbedJob as failJob,
  type DiaryEmbedJobKey
} from '@baishou/database-desktop'
import { getAppDb } from '../db'

export type { DiaryEmbedJobKey, DiaryEmbedJobStatus } from '@baishou/database-desktop'

function db() {
  return getAppDb()
}

/** Upsert 欠账：同一 vault+diary 只保留一行 */
export async function enqueueDiaryEmbedJob(job: DiaryEmbedJobKey, error?: string): Promise<void> {
  return enqueueJob(db(), job, error)
}

export async function deleteDiaryEmbedJob(vaultName: string, diaryId: number): Promise<void> {
  return deleteJob(db(), vaultName, diaryId)
}

export async function countDiaryEmbedJobs(): Promise<number> {
  return countJobs(db())
}

/** 取出可执行任务（pending / failed 且已到重试时间） */
export async function claimDiaryEmbedJobs(limit: number) {
  return claimJobs(db(), limit)
}

export async function completeDiaryEmbedJob(id: number): Promise<void> {
  return completeJob(db(), id)
}

export async function failDiaryEmbedJob(
  id: number,
  error: string,
  options?: { backoffMs?: number }
): Promise<void> {
  return failJob(db(), id, error, options)
}
