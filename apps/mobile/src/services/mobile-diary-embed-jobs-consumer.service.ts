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
} from './mobile-diary-embed-jobs.service'
import { getMobileDiaryEmbeddingCallback, getMobileDiaryEmbeddingDeps } from './mobile-diary-embedding.service'
import { resolveEmbeddingAdapter, resolveVaultScope } from './mobile-rag-core.helpers'
import { loadVaultDiariesForEmbedding } from './mobile-rag-vault-diary'

let consumeInFlight: Promise<{ processed: number; failed: number; skipped?: string }> | null = null

/**
 * 消费日记嵌入欠账：联网自动恢复 / 同步完成后调用。
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
    const deps = getMobileDiaryEmbeddingDeps()
    if (!deps) {
      return { processed: 0, failed: 0, skipped: 'deps-missing' }
    }

    const ragConfig =
      (await deps.settingsManager.get<RagConfig>('rag_config')) || ({} as RagConfig)

    if (!isRagMemoryEnabled(ragConfig)) {
      return { processed: 0, failed: 0, skipped: 'rag-disabled' }
    }
    if (!options?.force && !isAutoResumeEmbedOnOnline(ragConfig)) {
      return { processed: 0, failed: 0, skipped: 'auto-resume-disabled' }
    }

    const adapter = await resolveEmbeddingAdapter(deps)
    if (!adapter) {
      return { processed: 0, failed: 0, skipped: 'embedding-not-configured' }
    }

    let pending = 0
    try {
      pending = await countDiaryEmbedJobs()
    } catch {
      return { processed: 0, failed: 0, skipped: 'db-unbound' }
    }
    if (pending === 0) {
      return { processed: 0, failed: 0, skipped: 'empty' }
    }

    const limit = options?.limit ?? 20
    const jobs = await claimDiaryEmbedJobs(limit)
    logger.info('[MobileDiaryEmbedJobs] consuming', {
      reason: options?.reason ?? 'unspecified',
      claimed: jobs.length,
      pendingBefore: pending
    })

    const embeddingCallback = getMobileDiaryEmbeddingCallback()
    const vaultScope = await resolveVaultScope(deps)
    const shadowDb = vaultScope.getShadowDb?.() ?? null

    let processed = 0
    let failed = 0

    for (const job of jobs) {
      try {
        const diaryById = shadowDb
          ? await loadVaultDiariesForEmbedding(shadowDb, job.vaultName, [job.diaryId])
          : await deps.diaryService.findByIdsForEmbedding([job.diaryId])

        const diary = diaryById.get(job.diaryId)
        const content = diary && 'content' in diary ? diary.content : undefined
        if (!diary || !content?.trim()) {
          await completeDiaryEmbedJob(job.id)
          continue
        }

        const dateRaw = 'date' in diary ? diary.date : undefined
        const dateStr =
          typeof dateRaw === 'string'
            ? dateRaw
            : dateRaw instanceof Date
              ? dateRaw.toISOString().slice(0, 10)
              : String(dateRaw ?? '')

        const updatedAt =
          'updatedAt' in diary && diary.updatedAt instanceof Date
            ? diary.updatedAt
            : new Date()

        const tags = normalizeDiaryTags('tags' in diary ? diary.tags : [])

        const ok = await embeddingCallback.reEmbedDiary({
          diaryId: job.diaryId,
          content,
          tags,
          date: dateStr,
          updatedAt,
          vaultName: job.vaultName
        })

        if (ok) {
          await completeDiaryEmbedJob(job.id)
          processed++
        } else {
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

export function scheduleConsumeDiaryEmbedJobs(reason: string): void {
  void consumeDiaryEmbedJobs({ reason }).catch((e) => {
    logger.warn('[MobileDiaryEmbedJobs] consume failed', {
      reason,
      error: e instanceof Error ? e.message : String(e)
    })
  })
}
