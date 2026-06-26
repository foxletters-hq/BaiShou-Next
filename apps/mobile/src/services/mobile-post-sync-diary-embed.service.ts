import { logger } from '@baishou/shared'

import {
  getMobileDiaryEmbeddingDeps,
  notifyDiaryEmbedFailure
} from './mobile-diary-embedding.service'
import {
  runControlledDiaryBatchEmbed,
  type ControlledDiaryBatchEmbedResult
} from './mobile-rag.service'

let inFlight: Promise<ControlledDiaryBatchEmbedResult> | null = null
let rerunRequested = false

async function runPostSyncDiaryBatchEmbedLoop(): Promise<ControlledDiaryBatchEmbedResult> {
  let lastResult: ControlledDiaryBatchEmbedResult = {
    embedded: 0,
    failed: 0,
    total: 0,
    skipped: true,
    skipReason: 'not-started'
  }

  do {
    rerunRequested = false
    const deps = getMobileDiaryEmbeddingDeps()
    if (!deps) {
      return { embedded: 0, failed: 0, total: 0, skipped: true, skipReason: 'deps-unavailable' }
    }

    lastResult = await runControlledDiaryBatchEmbed(deps, {
      groupId: 'diary_post_sync'
    })

    if (lastResult.failed > 0 || lastResult.skipReason === 'prepare-failed') {
      notifyDiaryEmbedFailure()
    }
  } while (rerunRequested)

  return lastResult
}

/** 同步完成后在后台触发受控批量嵌入（单飞 + 可合并重复调度） */
export function schedulePostSyncDiaryBatchEmbed(): void {
  if (inFlight) {
    rerunRequested = true
    return
  }

  inFlight = runPostSyncDiaryBatchEmbedLoop()
    .catch((error: unknown) => {
      logger.warn('[MobilePostSyncEmbed] post-sync batch embed failed', error as Error)
      notifyDiaryEmbedFailure()
      return {
        embedded: 0,
        failed: 0,
        total: 0,
        skipped: true,
        skipReason: 'failed'
      } satisfies ControlledDiaryBatchEmbedResult
    })
    .finally(() => {
      inFlight = null
    })
}
