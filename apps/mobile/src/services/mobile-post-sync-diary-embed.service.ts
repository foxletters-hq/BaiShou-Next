import { logger } from '@baishou/shared'

import {
  getMobileDiaryEmbeddingDeps,
  notifyDiaryEmbedFailure
} from './mobile-diary-embedding.service'
import { scheduleConsumeDiaryEmbedJobs } from './mobile-diary-embed-jobs-consumer.service'
import {
  MobileRagAbortError,
  isMobileRagReembedInFlight,
  requestDeferredPostSyncEmbed,
  runControlledDiaryBatchEmbed
} from './mobile-rag.service'

/** 同步完成后在后台触发受控批量嵌入（单飞 + 可合并重复调度） */
export function schedulePostSyncDiaryBatchEmbed(): void {
  const deps = getMobileDiaryEmbeddingDeps()
  if (!deps) return

  if (isMobileRagReembedInFlight()) {
    requestDeferredPostSyncEmbed()
    return
  }

  void runControlledDiaryBatchEmbed(deps, {
    groupId: 'diary_post_sync',
    coalesceRerun: true
  })
    .then((result) => {
      if (result.failed > 0 || result.skipReason === 'prepare-failed') {
        notifyDiaryEmbedFailure()
      }
      scheduleConsumeDiaryEmbedJobs('post-sync-batch')
    })
    .catch((error: unknown) => {
      if (error instanceof MobileRagAbortError) return
      logger.warn('[MobilePostSyncEmbed] post-sync batch embed failed', error as Error)
      notifyDiaryEmbedFailure()
      scheduleConsumeDiaryEmbedJobs('post-sync-batch-error')
    })
}
