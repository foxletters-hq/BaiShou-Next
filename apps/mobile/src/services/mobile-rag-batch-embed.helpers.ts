import i18n from 'i18next'
import {
  applyFrozenPhaseProgress,
  coerceDiaryCalendarDate,
  EMBED_API_PROBE_FAILURE_MESSAGE,
  filterUnindexedDiaries,
  firstActivePhase,
  formatAiApiCallError,
  formatLocalDate,
  isRagMemoryEnabled,
  limitExecute,
  logger,
  overallFromPhaseCounts,
  phaseCountsFromPending,
  probeEmbeddingApi,
  resolveMobileBatchEmbedConcurrency,
  sortDiariesByDateAsc,
  buildDiaryEmbeddingSourceId,
  type PendingEmbedCounts,
  type RagBatchEmbedPhaseCounts,
  type RagBatchEmbedPhaseKind,
  type DiaryEmbedDetectionRow
} from '@baishou/shared'
import {
  MobileRagAbortError,
  assertMobileRagCanContinue,
  mobileRagOperationControl
} from './mobile-rag-operation-control'
import {
  purgeAllLegacyDiaryEmbeddings,
  purgeLegacyDiaryEmbeddingsForVault
} from './mobile-diary-embedding.util'
import {
  listVaultDiaryMetas,
  loadVaultDiariesForEmbedding,
  resolveMobileDiaryEmbedListSource
} from './mobile-rag-vault-diary'
import { resetCachedMobileRagActiveState } from './mobile-rag-runtime-cache'
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

type OrganizeCounts = PendingEmbedCounts & {
  graphExtract?: number
  graphDisambiguate?: number
}

type RawSqlClient = {
  execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
}

async function loadOrganizeCountsForBatch(
  deps: MobileRagServiceDeps
): Promise<OrganizeCounts | undefined> {
  try {
    const { getOrganizePendingSnapshot } = await import('./mobile-pending-embed-counts')
    return await getOrganizePendingSnapshot(deps)
  } catch {
    return undefined
  }
}

function phaseCountsFromOrganize(counts?: OrganizeCounts): RagBatchEmbedPhaseCounts {
  return phaseCountsFromPending({
    diaries: counts?.diaries ?? 0,
    memories: counts?.memories ?? 0,
    graphNodes: counts?.graphNodes ?? 0,
    knowledgeSources: counts?.knowledgeSources ?? 0,
    graphExtract: counts?.graphExtract ?? 0,
    graphDisambiguate: counts?.graphDisambiguate ?? 0
  })
}

function stopMobileGraphExtractQueueSafely(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./mobile-graph-extract-queue.service').mobileGraphExtractQueue?.stop?.()
  } catch {}
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
      result.lastError ||
        `成功嵌入 ${result.embedded} 篇，${result.failed} 篇失败（共 ${result.total} 篇待处理）`
    )
  }
  return result.embedded
}

async function runPendingFillAfterDiaryBatch(
  deps: MobileRagServiceDeps,
  onProgress?: RagProgressCallback,
  counts?: OrganizeCounts
) {
  try {
    const { runMobileManualPendingEmbedFill } = await import('./mobile-pending-embed-fill')
    return await runMobileManualPendingEmbedFill(deps, {
      counts,
      onProgress: ({ completed, total, statusText, phase, phases }) => {
        onProgress?.({ current: completed, total, status: statusText, phase, phases })
      }
    })
  } catch (error) {
    stopMobileGraphExtractQueueSafely()
    logger.warn('[MobileRag] pending embed fill after diary batch failed', error as Error)
    throw error
  }
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
  mobileRagOperationControl.begin()
  const progressType = options?.progressType ?? 'batchEmbed'
  const onProgress = chainRagProgressCallback(progressType, options?.onProgress)
  logger.info('[MobileRag] batch embed core start', { stack: new Error().stack })
  try {
    const ragConfig = (await deps.settingsManager.get<{ ragEnabled?: boolean }>('rag_config')) || {}
    if (!isRagMemoryEnabled({ ragEnabled: ragConfig.ragEnabled ?? true })) {
      logger.warn('[MobileRag] batch embed skipped', { skipReason: 'rag-disabled' })
      return { embedded: 0, failed: 0, total: 0, skipped: true, skipReason: 'rag-disabled' }
    }

    const adapter = await resolveEmbeddingAdapter(deps)
    if (!adapter) {
      logger.warn('[MobileRag] batch embed skipped', { skipReason: 'embedding-not-configured' })
      return {
        embedded: 0,
        failed: 0,
        total: 0,
        skipped: true,
        skipReason: 'embedding-not-configured'
      }
    }

    const probe = await probeEmbeddingApi((text) => adapter.embedQuery(text))
    if (!probe.ok) {
      await finalizeBatchEmbedRagConfig(deps, true)
      throw new Error(probe.message || EMBED_API_PROBE_FAILURE_MESSAGE)
    }

    try {
      await prepareMobileEmbeddingIndex(deps, adapter)
    } catch (error) {
      if (error instanceof MobileRagAbortError) throw error
      logger.error('[MobileRag] prepare embedding index failed', { error })
      await finalizeBatchEmbedRagConfig(deps, true)
      return { embedded: 0, failed: 0, total: 0, skipped: true, skipReason: 'prepare-failed' }
    }

    const purgedLegacy = await purgeAllLegacyDiaryEmbeddings(
      deps.rawSqlClient as RawSqlClient | undefined
    )
    if (purgedLegacy > 0)
      logger.info('[MobileRag] purged legacy diary vectors', { count: purgedLegacy })

    const organizeCounts = await loadOrganizeCountsForBatch(deps)
    let phases = phaseCountsFromOrganize(organizeCounts)
    const reportOrganizeProgress = (
      status: string,
      phase: RagBatchEmbedPhaseKind,
      nextPhases: RagBatchEmbedPhaseCounts
    ) => {
      phases = nextPhases
      const overall = overallFromPhaseCounts(phases)
      onProgress?.({ current: overall.completed, total: overall.total, status, phase, phases })
    }
    reportOrganizeProgress(
      i18n.t('settings.rag_batch_embed_starting', '正在开始索引…'),
      firstActivePhase({
        diaries: organizeCounts?.diaries ?? 0,
        memories: organizeCounts?.memories ?? 0,
        graphNodes: organizeCounts?.graphNodes ?? 0,
        knowledgeSources: organizeCounts?.knowledgeSources ?? 0,
        graphExtract: organizeCounts?.graphExtract ?? 0
      }),
      phases
    )

    const vaultScope = await resolveVaultScope(deps)
    const shadowDb = vaultScope.getShadowDb?.() ?? null
    const vaultNameOpt = options?.vaultName?.trim()
    const vaultEntries = vaultNameOpt
      ? [{ id: await vaultScope.resolveVaultIdByName(vaultNameOpt), name: vaultNameOpt }]
      : await vaultScope.listVaultEntries()
    const activeVaultName = await vaultScope.resolveActiveVaultName()
    const activeVaultId = await vaultScope.resolveActiveVaultId()
    if (activeVaultId) {
      await import('./mobile-pending-embed-fill')
        .then((m) => m.bindGraphExtractQueueContext(deps, activeVaultId))
        .catch(() => {})
    }

    const vaultPlans: Array<{
      vaultId: string
      vaultName: string
      listSource: ReturnType<typeof resolveMobileDiaryEmbedListSource>
      diariesToEmbed: DiaryEmbedDetectionRow[]
      allDiaryIds: number[]
    }> = []
    let globalTotal = 0

    for (const { id: vaultId, name: vaultName } of vaultEntries) {
      const listSource = resolveMobileDiaryEmbedListSource({
        isActiveVault: vaultName === activeVaultName,
        hasShadowDb: Boolean(shadowDb)
      })
      if (listSource === 'none') {
        logger.warn('[MobileRag] skipping non-active vault batch embed without shadow index', {
          vaultName,
          activeVaultName
        })
      }
      const allDiaries = sortDiariesByDateAsc(
        listSource === 'live'
          ? await deps.diaryService.listForEmbedDetection()
          : listSource === 'shadow' && shadowDb
            ? await listVaultDiaryMetas(shadowDb, vaultId)
            : []
      )
      const { embeddedIds, embeddedUpdatedAtMap, embeddedContentHashMap } =
        await loadEmbeddedDiaryIndex(deps, vaultId)
      const diariesToEmbed = filterUnindexedDiaries(allDiaries, embeddedIds, embeddedUpdatedAtMap, {
        resolveSourceId: (meta: { id: unknown }) =>
          buildDiaryEmbeddingSourceId(vaultId, meta.id as number),
        embeddedContentHashMap
      })
      if (diariesToEmbed.length === 0) continue
      vaultPlans.push({
        vaultId,
        vaultName,
        listSource,
        diariesToEmbed,
        allDiaryIds: allDiaries.map((d) => d.id)
      })
      globalTotal += diariesToEmbed.length
    }

    if (globalTotal === 0) {
      await finalizeBatchEmbedRagConfig(deps, false)
      const fillResult = await runPendingFillAfterDiaryBatch(deps, onProgress, organizeCounts)
      const { invalidateMobilePendingEmbedCountsCache } =
        await import('./mobile-pending-embed-counts')
      invalidateMobilePendingEmbedCountsCache()
      // 日记为 0 仍走 fill；只有 fill 也确认无待办才标 nothing-to-embed
      if (fillResult.skippedReason === 'nothing-to-embed') {
        return { embedded: 0, failed: 0, total: 0, skipped: true, skipReason: 'nothing-to-embed' }
      }
      return { embedded: 0, failed: 0, total: 0, skipped: false }
    }

    reportOrganizeProgress(
      i18n.t('settings.rag_indexing_diary', '正在嵌入日记…'),
      'diary',
      applyFrozenPhaseProgress(phases, 'diary', { completed: 0, total: globalTotal })
    )

    const ragSettings =
      (await deps.settingsManager.get<{ batchEmbedConcurrency?: number }>('rag_config')) || {}
    const batchConcurrency = resolveMobileBatchEmbedConcurrency(ragSettings.batchEmbedConcurrency)

    const progress = {
      embedded: 0,
      failed: 0,
      loadSkipped: 0,
      completed: 0,
      lastError: undefined as string | undefined
    }
    let abortAfterRetryExhausted = false
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./mobile-graph-extract-queue.service').mobileGraphExtractQueue?.clearError?.()
    } catch {}

    const reportProgress = (status: string) => {
      let nextPhases = applyFrozenPhaseProgress(phases, 'diary', {
        completed: progress.completed,
        total: globalTotal
      })
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { mobileGraphExtractQueue } = require('./mobile-graph-extract-queue.service')
        const queueState = mobileGraphExtractQueue?.getQueueState?.()
        if (queueState && queueState.items?.length > 0) {
          const completedExtract = queueState.completedCount
          if (completedExtract > 0) {
            nextPhases = applyFrozenPhaseProgress(nextPhases, 'graph_extract', {
              completed: completedExtract,
              total: Math.max(nextPhases.graphExtract.total, queueState.items.length)
            })
          }
        }
      } catch {}
      reportOrganizeProgress(status, 'diary', nextPhases)
    }

    try {
      for (const plan of vaultPlans) {
        if (abortAfterRetryExhausted) break
        const { vaultId, vaultName, listSource, diariesToEmbed, allDiaryIds } = plan
        await purgeLegacyDiaryEmbeddingsForVault(
          deps.rawSqlClient as RawSqlClient | undefined,
          vaultId,
          allDiaryIds
        )

        const diaryById =
          listSource === 'live'
            ? await deps.diaryService.findByIdsForEmbedding(diariesToEmbed.map((meta) => meta.id))
            : shadowDb
              ? await loadVaultDiariesForEmbedding(
                  shadowDb,
                  vaultId,
                  diariesToEmbed.map((meta) => meta.id)
                )
              : new Map()

        await limitExecute(
          diariesToEmbed,
          batchConcurrency,
          async (meta) => {
            if (abortAfterRetryExhausted) return
            await assertMobileRagCanContinue()
            if (mobileRagOperationControl.isAborted) return

            const dateLabel = meta.date
              ? formatLocalDate(coerceDiaryCalendarDate(meta.date) ?? new Date())
              : ''
            let itemFailed = false

            try {
              reportProgress(
                `[${vaultName}] 处理日记: ${dateLabel}（${progress.completed}/${globalTotal}）`
              )
              if (mobileRagOperationControl.isAborted) return

              const diary = diaryById.get(meta.id)
              diaryById.delete(meta.id)
              const content = diary && 'content' in diary ? diary.content : undefined
              if (!diary) {
                progress.loadSkipped++
                return
              }

              const d = coerceDiaryCalendarDate(diary.date ?? meta.date) ?? new Date()
              const updatedAt =
                ('updatedAt' in diary && diary.updatedAt instanceof Date
                  ? diary.updatedAt
                  : meta.updatedAt) ?? new Date()
              const entryArgs = {
                diaryId: meta.id,
                content: content ?? '',
                tags: [],
                date: d,
                updatedAt,
                vaultName
              }
              const entryOpts = {
                adapter,
                skipIndexPrep: true,
                skipRagEnabledCheck: true,
                contentHash: meta.contentHash
              }
              for (let attempt = 0; attempt <= 3; attempt++) {
                try {
                  await embedDiaryEntry(deps, entryArgs, entryOpts)
                  break
                } catch (embedError) {
                  if (mobileRagOperationControl.isAborted || attempt >= 3) throw embedError
                }
              }

              if (!content?.trim()) {
                progress.loadSkipped++
                return
              }
              progress.embedded++
            } catch (error) {
              if (mobileRagOperationControl.isAborted) return
              itemFailed = true
              progress.failed++
              abortAfterRetryExhausted = true
              progress.lastError = formatAiApiCallError(error)
              logger.warn('[MobileRag] diary embed failed after retries', {
                vaultName,
                diaryId: meta.id,
                date: dateLabel,
                error
              })
            } finally {
              if (!itemFailed) progress.completed++
              reportProgress(
                `[${vaultName}] 已嵌入 ${progress.embedded}/${globalTotal}${progress.failed > 0 ? `（失败 ${progress.failed}）` : ''}${progress.loadSkipped > 0 ? `（跳过 ${progress.loadSkipped}）` : ''}（${dateLabel}）`
              )
            }
          },
          { shouldStop: () => mobileRagOperationControl.isAborted || abortAfterRetryExhausted }
        )
      }
    } catch (error) {
      if (error instanceof MobileRagAbortError) {
        await finalizeBatchEmbedRagConfig(deps, progress.failed > 0)
        throw new MobileRagAbortError(progress.embedded)
      }
      throw error
    }

    await finalizeBatchEmbedRagConfig(deps, progress.failed > 0)
    if (mobileRagOperationControl.isAborted) {
      throw new MobileRagAbortError(progress.embedded)
    }
    if (progress.failed > 0) {
      stopMobileGraphExtractQueueSafely()
      return { ...progress, total: globalTotal, skipped: false }
    }

    await runPendingFillAfterDiaryBatch(deps, onProgress, organizeCounts)
    return { ...progress, total: globalTotal, skipped: false }
  } finally {
    mobileRagOperationControl.end()
    resetCachedMobileRagActiveState()
    void import('./mobile-diary-graph-follow-after-embed')
      .then((m) => m.clearMobileDiaryGraphFollowPendingCache())
      .catch(() => {})
    void import('./mobile-pending-embed-counts')
      .then((m) => m.notifyMobilePendingEmbedCountsChanged())
      .catch(() => {})
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
    if (options?.coalesceRerun) requestDeferredPostSyncEmbed()
    return { embedded: 0, failed: 0, total: 0, skipped: true, skipReason: 'migration-running' }
  }

  const runLoop = async (): Promise<ControlledDiaryBatchEmbedResult> => {
    let lastResult!: ControlledDiaryBatchEmbedResult
    do {
      clearBatchEmbedRerunRequested()
      lastResult = await runControlledDiaryBatchEmbedCore(deps, options)
    } while (isBatchEmbedRerunRequested() && !mobileRagOperationControl.isAborted)
    return lastResult
  }

  setBatchEmbedInFlight(runLoop().finally(() => setBatchEmbedInFlight(null)))
  return getBatchEmbedInFlight()!
}
