import {
  isAutoResumeEmbedOnOnline,
  isRagMemoryEnabled,
  logger,
  normalizeDiaryTags,
  type RagConfig
} from '@baishou/shared'
import {
  claimDiaryEmbedJobs,
  completeDiaryEmbedJob,
  countDiaryEmbedJobs,
  failDiaryEmbedJob
} from './diary-embed-jobs.service'

let consumeInFlight: Promise<{ processed: number; failed: number; skipped?: string }> | null = null

/**
 * 消费日记嵌入欠账：联网自动恢复 / 启动空闲时调用。
 */
export async function consumeDiaryEmbedJobs(options?: {
  limit?: number
  reason?: string
  /** 为 true 时忽略「联网自动恢复」开关（手动触发用） */
  force?: boolean
}): Promise<{ processed: number; failed: number; skipped?: string }> {
  if (consumeInFlight) {
    return consumeInFlight
  }

  consumeInFlight = (async () => {
    const { settingsManager } = await import('../ipc/settings.ipc')
    const ragConfig = (await settingsManager.get<RagConfig>('rag_config')) || ({} as RagConfig)

    if (!isRagMemoryEnabled(ragConfig)) {
      return { processed: 0, failed: 0, skipped: 'rag-disabled' }
    }
    if (!options?.force && !isAutoResumeEmbedOnOnline(ragConfig)) {
      return { processed: 0, failed: 0, skipped: 'auto-resume-disabled' }
    }

    const { getEmbeddingService } = await import('../ipc/rag.ipc')
    const embeddingService = getEmbeddingService()
    if (!embeddingService.isConfigured) {
      return { processed: 0, failed: 0, skipped: 'embedding-not-configured' }
    }

    const pending = await countDiaryEmbedJobs()
    if (pending === 0) {
      return { processed: 0, failed: 0, skipped: 'empty' }
    }

    const limit = options?.limit ?? 20
    const jobs = await claimDiaryEmbedJobs(limit)
    logger.info('[DiaryEmbedJobs] consuming', {
      reason: options?.reason ?? 'unspecified',
      claimed: jobs.length,
      pendingBefore: pending
    })

    const { embeddingCallback } = await import('../ipc/diary-embedding.callback')
    const { getDiaryManagerForVault } = await import('./diary-vault.factory')

    let processed = 0
    let failed = 0

    for (const job of jobs) {
      try {
        const diaryManager = await getDiaryManagerForVault(job.vaultName)
        const diaryMap = await diaryManager.findByIdsForEmbedding([job.diaryId])
        const diary = diaryMap.get(job.diaryId)
        if (!diary?.id || !diary.content?.trim()) {
          await completeDiaryEmbedJob(job.id)
          continue
        }

        const dateStr =
          typeof diary.date === 'string'
            ? diary.date
            : diary.date instanceof Date
              ? diary.date.toISOString()
              : String(diary.date)

        const ok = await embeddingCallback.reEmbedDiary({
          diaryId: Number(diary.id),
          content: diary.content,
          tags: normalizeDiaryTags(diary.tags),
          date: dateStr,
          updatedAt: diary.updatedAt instanceof Date ? diary.updatedAt : new Date(diary.updatedAt),
          vaultName: job.vaultName
        })

        if (ok) {
          await completeDiaryEmbedJob(job.id)
          processed++
        } else {
          // callback 已 upsert failed/pending；把 running 行标回 failed 并退避
          await failDiaryEmbedJob(job.id, 'embed-returned-false', {
            backoffMs: Math.min(30 * 60_000, 15_000 * Math.max(1, job.attempts))
          })
          failed++
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        await failDiaryEmbedJob(job.id, message, {
          backoffMs: Math.min(30 * 60_000, 15_000 * Math.max(1, job.attempts))
        })
        failed++
      }
    }

    return { processed, failed }
  })().finally(() => {
    consumeInFlight = null
  })

  return consumeInFlight
}

export async function getDiaryEmbedJobsPendingCount(): Promise<number> {
  return countDiaryEmbedJobs()
}

export function scheduleConsumeDiaryEmbedJobs(reason: string): void {
  void consumeDiaryEmbedJobs({ reason }).catch((e) => {
    logger.warn('[DiaryEmbedJobs] consume failed', {
      reason,
      error: e instanceof Error ? e.message : String(e)
    })
  })
}
