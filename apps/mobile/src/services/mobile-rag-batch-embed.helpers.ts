import i18n from 'i18next'
import {
  filterUnindexedDiaries,
  formatLocalDate,
  isRagMemoryEnabled,
  limitExecute,
  logger,
  resolveMobileBatchEmbedConcurrency,
  sortDiariesByDateAsc
} from '@baishou/shared'
import { MobileRagAbortError, mobileRagOperationControl } from './mobile-rag-operation-control'
import {
  purgeAllLegacyDiaryEmbeddings,
  purgeLegacyDiaryEmbeddingsForVault
} from './mobile-diary-embedding.util'
import { buildDiaryEmbeddingSourceId } from '@baishou/shared'
import { listVaultDiaryMetas, loadVaultDiariesForEmbedding } from './mobile-rag-vault-diary'
import { resetCachedMobileRagActiveState } from './mobile-rag-runtime-cache'
import type { DiaryMeta } from '@baishou/shared'
import {
  chainRagProgressCallback,
  embedDiaryEntry,
  finalizeBatchEmbedRagConfig,
  loadEmbeddedDiaryIndex,
  prepareMobileEmbeddingIndex,
  resolveEmbeddingAdapter,
  resolveVaultScope,
  type ControlledDiaryBatchEmbedResult,
  type MobileRagServiceDeps,
  type RagProgressCallback
} from './mobile-rag-core.helpers'
import {
  getBatchEmbedInFlight,
  setBatchEmbedInFlight,
  isBatchEmbedRerunRequested,
  setBatchEmbedRerunRequested,
  clearBatchEmbedRerunRequested,
  isReembedInFlight,
  requestDeferredPostSyncEmbed
} from './mobile-rag-state.helpers'

type RagProgressOperationType = 'batchEmbed' | 'reembed' | 'migration'

type RawSqlClient = {
  execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
}

export function resolveControlledDiaryBatchEmbedCount(
  result: ControlledDiaryBatchEmbedResult
): number {
  if (result.skipped && result.skipReason === 'migration-running') {
    throw new Error(
      i18n.t(
        'auto.apps.mobile.src.services.mobile.rag.batch.embed.helpers.L51',
        '嵌入任务正在进行中，请稍后再试'
      )
    )
  }
  if (result.skipped && result.skipReason === 'embedding-not-configured') {
    throw new Error(
      i18n.t('auto.apps.mobile.src.services.mobile.rag.batch.embed.helpers.L54', '嵌入模型未配置')
    )
  }
  if (result.skipped && result.skipReason === 'prepare-failed') {
    throw new Error(
      i18n.t(
        'auto.apps.mobile.src.services.mobile.rag.batch.embed.helpers.L57',
        '嵌入 API 未返回有效向量，请检查模型配置与网络'
      )
    )
  }
  if (result.failed > 0) {
    throw new Error(
      `成功嵌入 ${result.embedded} 篇，${result.failed} 篇失败（共 ${result.total} 篇待处理）`
    )
  }
  return result.embedded
}

export async function runControlledDiaryBatchEmbedCore(
  deps: MobileRagServiceDeps,
  options?: {
    onProgress?: RagProgressCallback
    progressType?: RagProgressOperationType
    /** @deprecated 请改用 vaultName */
    groupId?: string
    vaultName?: string
  }
): Promise<ControlledDiaryBatchEmbedResult> {
  mobileRagOperationControl.reset()
  const progressType = options?.progressType ?? 'batchEmbed'
  const onProgress = chainRagProgressCallback(progressType, options?.onProgress)
  try {
    const ragConfig = (await deps.settingsManager.get<{ ragEnabled?: boolean }>('rag_config')) || {}
    if (!isRagMemoryEnabled({ ragEnabled: ragConfig.ragEnabled ?? true })) {
      return { embedded: 0, failed: 0, total: 0, skipped: true, skipReason: 'rag-disabled' }
    }

    const adapter = await resolveEmbeddingAdapter(deps)
    if (!adapter) {
      return {
        embedded: 0,
        failed: 0,
        total: 0,
        skipped: true,
        skipReason: 'embedding-not-configured'
      }
    }

    try {
      await prepareMobileEmbeddingIndex(deps, adapter)
    } catch (error) {
      if (error instanceof MobileRagAbortError) {
        throw error
      }
      logger.error('[MobileRag] prepare embedding index failed', { error })
      await finalizeBatchEmbedRagConfig(deps, true)
      return { embedded: 0, failed: 0, total: 0, skipped: true, skipReason: 'prepare-failed' }
    }

    const purgedLegacy = await purgeAllLegacyDiaryEmbeddings(
      deps.rawSqlClient as RawSqlClient | undefined
    )
    if (purgedLegacy > 0) {
      logger.info('[MobileRag] purged legacy diary vectors', { count: purgedLegacy })
    }

    const vaultScope = await resolveVaultScope(deps)
    const shadowDb = vaultScope.getShadowDb?.() ?? null
    const vaultNames = options?.vaultName?.trim()
      ? [options.vaultName.trim()]
      : await vaultScope.listVaultNames()
    const activeVaultName = await vaultScope.resolveActiveVaultName()

    type VaultEmbedPlan = {
      vaultName: string
      diariesToEmbed: DiaryMeta[]
      allDiaryIds: number[]
    }

    const vaultPlans: VaultEmbedPlan[] = []
    let globalTotal = 0

    for (const vaultName of vaultNames) {
      if (!shadowDb && vaultName !== activeVaultName) {
        logger.warn('[MobileRag] skipping non-active vault batch embed without shadow index', {
          vaultName,
          activeVaultName
        })
      }
      const allDiaries = sortDiariesByDateAsc(
        shadowDb
          ? await listVaultDiaryMetas(shadowDb, vaultName)
          : vaultName === activeVaultName
            ? await deps.diaryService.listAll({ limit: 10000 })
            : []
      )
      const { embeddedIds, embeddedUpdatedAtMap } = await loadEmbeddedDiaryIndex(deps, vaultName)
      const resolveSourceId = (meta: { id: unknown }) =>
        buildDiaryEmbeddingSourceId(vaultName, meta.id as number)
      const diariesToEmbed = filterUnindexedDiaries(allDiaries, embeddedIds, embeddedUpdatedAtMap, {
        resolveSourceId
      })
      if (diariesToEmbed.length === 0) continue
      vaultPlans.push({
        vaultName,
        diariesToEmbed,
        allDiaryIds: allDiaries.map((d) => d.id)
      })
      globalTotal += diariesToEmbed.length
    }

    if (globalTotal === 0) {
      await finalizeBatchEmbedRagConfig(deps, false)
      return { embedded: 0, failed: 0, total: 0, skipped: true, skipReason: 'nothing-to-embed' }
    }

    onProgress?.({
      current: 0,
      total: globalTotal,
      status: ''
    })

    const ragSettings =
      (await deps.settingsManager.get<{ batchEmbedConcurrency?: number }>('rag_config')) || {}
    const batchConcurrency = resolveMobileBatchEmbedConcurrency(ragSettings.batchEmbedConcurrency)

    const progress = { embedded: 0, failed: 0, loadSkipped: 0, completed: 0 }

    const reportProgress = (status: string) => {
      onProgress?.({
        current: progress.completed,
        total: globalTotal,
        status
      })
    }

    for (const plan of vaultPlans) {
      const { vaultName, diariesToEmbed, allDiaryIds } = plan
      await purgeLegacyDiaryEmbeddingsForVault(
        deps.rawSqlClient as RawSqlClient | undefined,
        vaultName,
        allDiaryIds
      )

      const diaryById = shadowDb
        ? await loadVaultDiariesForEmbedding(
            shadowDb,
            vaultName,
            diariesToEmbed.map((meta) => meta.id)
          )
        : await deps.diaryService.findByIdsForEmbedding(diariesToEmbed.map((meta) => meta.id))

      await limitExecute(diariesToEmbed, batchConcurrency, async (meta) => {
        if (mobileRagOperationControl.isAborted) {
          return
        }

        const dateLabel = meta.date
          ? formatLocalDate(meta.date instanceof Date ? meta.date : new Date(meta.date))
          : ''

        try {
          reportProgress(
            `[${vaultName}] 处理日记: ${dateLabel}（${progress.completed}/${globalTotal}）`
          )

          if (mobileRagOperationControl.isAborted) {
            return
          }

          const diary = diaryById.get(meta.id)
          const content = diary && 'content' in diary ? diary.content : undefined
          if (!diary || !content?.trim()) {
            progress.loadSkipped++
            return
          }

          const d =
            diary.date instanceof Date ? diary.date : new Date(String(diary.date ?? meta.date))
          await embedDiaryEntry(
            deps,
            {
              diaryId: meta.id,
              content,
              tags: meta.tags ?? [],
              date: d,
              updatedAt:
                ('updatedAt' in diary && diary.updatedAt instanceof Date
                  ? diary.updatedAt
                  : meta.updatedAt) ?? new Date(),
              vaultName
            },
            { adapter, skipIndexPrep: true, skipRagEnabledCheck: true }
          )

          progress.embedded++
        } catch (error) {
          if (mobileRagOperationControl.isAborted) {
            return
          }
          progress.failed++
          logger.warn('[MobileRag] diary embed failed', {
            vaultName,
            diaryId: meta.id,
            date: dateLabel,
            error
          })
        } finally {
          progress.completed++
          reportProgress(
            `[${vaultName}] 已嵌入 ${progress.embedded}/${globalTotal}${progress.failed > 0 ? `（失败 ${progress.failed}）` : ''}${progress.loadSkipped > 0 ? `（跳过 ${progress.loadSkipped}）` : ''}（${dateLabel}）`
          )
        }
      })
    }

    await finalizeBatchEmbedRagConfig(deps, progress.failed > 0)

    if (mobileRagOperationControl.isAborted) {
      logger.info('[MobileRag] controlled batch embed aborted', {
        embedded: progress.embedded,
        failed: progress.failed,
        total: globalTotal
      })
      throw new MobileRagAbortError(progress.embedded)
    }

    logger.info('[MobileRag] controlled batch embed finished', {
      embedded: progress.embedded,
      failed: progress.failed,
      loadSkipped: progress.loadSkipped,
      total: globalTotal,
      vaultCount: vaultPlans.length
    })
    return {
      embedded: progress.embedded,
      failed: progress.failed,
      loadSkipped: progress.loadSkipped,
      total: globalTotal,
      skipped: false
    }
  } finally {
    resetCachedMobileRagActiveState()
  }
}

export async function runControlledDiaryBatchEmbed(
  deps: MobileRagServiceDeps,
  options?: {
    onProgress?: RagProgressCallback
    /** @deprecated 请改用 vaultName */
    groupId?: string
    vaultName?: string
    /** 同步后调度：合并重复请求，等待当前任务结束后必要时再跑一轮 */
    coalesceRerun?: boolean
  }
): Promise<ControlledDiaryBatchEmbedResult> {
  if (getBatchEmbedInFlight()) {
    if (options?.coalesceRerun) {
      setBatchEmbedRerunRequested(true)
      return getBatchEmbedInFlight()!
    }
    return { embedded: 0, failed: 0, total: 0, skipped: true, skipReason: 'migration-running' }
  }
  if (isReembedInFlight()) {
    if (options?.coalesceRerun) {
      requestDeferredPostSyncEmbed()
    }
    return { embedded: 0, failed: 0, total: 0, skipped: true, skipReason: 'migration-running' }
  }

  const runLoop = async (): Promise<ControlledDiaryBatchEmbedResult> => {
    let lastResult: ControlledDiaryBatchEmbedResult = {
      embedded: 0,
      failed: 0,
      total: 0,
      skipped: true,
      skipReason: 'not-started'
    }
    do {
      clearBatchEmbedRerunRequested()
      lastResult = await runControlledDiaryBatchEmbedCore(deps, options)
    } while (isBatchEmbedRerunRequested() && !mobileRagOperationControl.isAborted)
    return lastResult
  }

  setBatchEmbedInFlight(
    runLoop().finally(() => {
      setBatchEmbedInFlight(null)
    })
  )
  return getBatchEmbedInFlight()!
}
