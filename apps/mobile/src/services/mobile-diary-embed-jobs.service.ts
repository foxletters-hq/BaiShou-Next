import {
  claimDiaryEmbedJobs as claimJobs,
  completeDiaryEmbedJob as completeJob,
  countDiaryEmbedJobs as countJobs,
  deleteDiaryEmbedJob as deleteJob,
  enqueueDiaryEmbedJob as enqueueJob,
  failDiaryEmbedJob as failJob,
  type AppDatabase,
  type DiaryEmbedJobKey
} from '@baishou/database'

let agentDb: AppDatabase | null = null

export function bindMobileDiaryEmbedJobsDb(db: AppDatabase | null): void {
  agentDb = db
}

function requireDb(): AppDatabase {
  if (!agentDb) {
    throw new Error('[MobileDiaryEmbedJobs] agent DB not bound')
  }
  return agentDb
}

export async function enqueueDiaryEmbedJob(job: DiaryEmbedJobKey, error?: string): Promise<void> {
  if (!agentDb) return
  await enqueueJob(agentDb, job, error)
}

export async function deleteDiaryEmbedJob(vaultName: string, diaryId: number): Promise<void> {
  if (!agentDb) return
  await deleteJob(agentDb, vaultName, diaryId)
}

export async function countDiaryEmbedJobs(): Promise<number> {
  if (!agentDb) return 0
  return countJobs(agentDb)
}

export async function claimDiaryEmbedJobs(limit: number) {
  return claimJobs(requireDb(), limit)
}

export async function completeDiaryEmbedJob(id: number): Promise<void> {
  await completeJob(requireDb(), id)
}

export async function failDiaryEmbedJob(
  id: number,
  error: string,
  options?: { backoffMs?: number }
): Promise<void> {
  await failJob(requireDb(), id, error, options)
}
