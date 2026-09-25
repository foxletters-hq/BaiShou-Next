import i18n from 'i18next'
import { EmbeddingAdapter } from '@baishou/ai'
import {
  backfillUnembeddedGraphNodes,
  EMBED_API_UNAVAILABLE,
  isEmbedApiUnavailableError
} from '@baishou/core-desktop'
import {
  connectionManager,
  createSqlExecutorFromDrizzleDb,
  GraphRepository,
  SqliteHybridSearchRepository
} from '@baishou/database-desktop'
import {
  logger,
  markPhaseDone,
  overallFromPhaseCounts,
  patchPhaseCounts,
  phaseCountsFromPending,
  type PendingEmbedCounts,
  type RagBatchEmbedPhaseCounts,
  type RagBatchEmbedPhaseKind
} from '@baishou/shared'
import { resolveActiveVaultId } from '../ipc/vault.ipc'
import {
  assertBatchEmbedCanContinue,
  isBatchEmbedAbortedError
} from './batch-embed-control.service'
import { syncMemoryPendingIndex } from './raw-data-source.runtime'
import {
  invalidatePendingEmbedCountsCache,
  notifyPendingEmbedCountsChanged
} from './pending-embed-counts.service'
import { probeEmbeddingApi } from './embed-api-probe.util'

export type PendingEmbedFillProgress = {
  completed: number
  total: number
  statusText: string
  phase: RagBatchEmbedPhaseKind
  phases: RagBatchEmbedPhaseCounts
}

export type PendingEmbedFillResult = {
  graphUpdated: number
  graphFailed: number
  graphTotal: number
  skippedReason?: 'no-vault' | 'adapter-unavailable'
}

export async function runManualPendingEmbedFill(options?: {
  onProgress?: (progress: PendingEmbedFillProgress) => void
  counts?: Pick<PendingEmbedCounts, 'diaries' | 'memories' | 'graphNodes' | 'total'> & {
    graphExtract?: number
    graphDisambiguate?: number
  }
}): Promise<PendingEmbedFillResult> {
  const empty: PendingEmbedFillResult = { graphUpdated: 0, graphFailed: 0, graphTotal: 0 }
  const vaultId = resolveActiveVaultId()?.trim()
  if (!vaultId || !connectionManager.isConnected()) {
    return { ...empty, skippedReason: 'no-vault' }
  }

  const drizzleDb = connectionManager.getDb()
  const hsRepo = new SqliteHybridSearchRepository(createSqlExecutorFromDrizzleDb(drizzleDb))
  let embeddingAdapter: EmbeddingAdapter | null = null
  try {
    const { resolveEmbeddingSystemModels } = await import('../ipc/agent-helpers')
    const { embeddingProvider, embeddingModelId } = await resolveEmbeddingSystemModels()
    if (embeddingProvider && embeddingModelId) {
      embeddingAdapter = new EmbeddingAdapter(embeddingProvider, embeddingModelId, hsRepo)
    }
  } catch (error) {
    logger.warn('[PendingEmbedFill] embedding adapter unavailable', error as Error)
  }
  if (!embeddingAdapter?.isConfigured || !(embeddingAdapter.embeddingModelId ?? '').trim()) {
    return { ...empty, skippedReason: 'adapter-unavailable' }
  }
  const adapter = embeddingAdapter

  const probe = await probeEmbeddingApi((text) => adapter.embedQuery(text))
  if (!probe.ok) {
    throw new Error(`${EMBED_API_UNAVAILABLE}: ${probe.message}`)
  }

  let phases = markPhaseDone(
    phaseCountsFromPending({
      diaries: options?.counts?.diaries ?? 0,
      memories: options?.counts?.memories ?? 0,
      graphNodes: options?.counts?.graphNodes ?? 0,
      graphExtract: options?.counts?.graphExtract ?? 0,
      graphDisambiguate: options?.counts?.graphDisambiguate ?? 0
    }),
    'diary'
  )

  const report = (phase: RagBatchEmbedPhaseKind, next: RagBatchEmbedPhaseCounts) => {
    phases = next
    const overall = overallFromPhaseCounts(phases)
    const statusText =
      phase === 'memory'
        ? i18n.t('settings.rag_indexing_memory', '正在嵌入伙伴记忆…')
        : phase === 'graph_node'
          ? i18n.t('settings.rag_indexing_graph_node', '正在嵌入图谱节点…')
          : phase === 'graph_extract'
              ? i18n.t('settings.rag_indexing_graph_extract', '正在整理关系图谱…')
              : phase === 'graph_disambiguate'
                ? i18n.t('settings.rag_indexing_graph_disambiguate', '正在复核可疑图谱节点…')
                : i18n.t('settings.rag_batch_embed_finishing', '正在完成索引…')
    options?.onProgress?.({
      completed: overall.completed,
      total: overall.total,
      statusText,
      phase,
      phases
    })
  }

  if (phases.memories.total > 0) {
    report('memory', phases)
  }
  try {
    await assertBatchEmbedCanContinue()
    await syncMemoryPendingIndex({
      hsRepo,
      embeddingAdapter: adapter,
      vaultId,
      embedMissing: true
    })
  } catch (error) {
    if (isBatchEmbedAbortedError(error)) throw error
    logger.warn('[PendingEmbedFill] memory fill failed', error as Error)
  }
  phases = markPhaseDone(phases, 'memory')

  try {
    await assertBatchEmbedCanContinue()
    let extractDone = 0
    let extractTotal = phases.graphExtract.total

    const { GraphExtractQueueService } = await import('./graph-extract-queue.service')
    const { enqueueGraphExtract } = await import('../ipc/graph.ipc')
    const extractQueue = GraphExtractQueueService.getInstance()
    try {
      invalidatePendingEmbedCountsCache()
      const queued = await enqueueGraphExtract(extractQueue)
      extractTotal = Math.max(extractTotal, extractDone + queued.totalPending)
      if (extractTotal > 0) {
        report(
          'graph_extract',
          patchPhaseCounts(phases, 'graph_extract', {
            completed: extractDone,
            total: extractTotal
          })
        )
      }
      if (extractQueue.isRunning || queued.queued > 0) {
        await extractQueue.waitUntilIdle({
          shouldContinue: async () => {
            try {
              await assertBatchEmbedCanContinue()
              return true
            } catch {
              return false
            }
          },
          onProgress: (state) => {
            const completed = extractDone + state.completedCount + state.errorCount
            report(
              'graph_extract',
              patchPhaseCounts(phases, 'graph_extract', {
                completed,
                total: Math.max(extractTotal, extractDone + state.items.length)
              })
            )
          }
        })
      }
    } catch (error) {
      if (isBatchEmbedAbortedError(error)) {
        extractQueue.stop()
        throw error
      }
      logger.warn('[PendingEmbedFill] diary graph extract failed', error as Error)
    }
  } catch (error) {
    if (isBatchEmbedAbortedError(error)) throw error
    logger.warn('[PendingEmbedFill] graph extract phase failed', error as Error)
  }
  phases = markPhaseDone(phases, 'graph_extract')

  // 抽图会新建节点；结束后再补 embedding 仍为空的空位，避免抽图前写入旧空位。
  let graphResult = { updated: 0, failed: 0, total: 0 }
  try {
    await assertBatchEmbedCanContinue()
    const graphRepo = new GraphRepository(drizzleDb)
    const liveUnembedded = await graphRepo.listUnembeddedLiveNodes(vaultId)
    if (liveUnembedded.length > 0) {
      phases = patchPhaseCounts(phases, 'graph_node', {
        completed: 0,
        total: liveUnembedded.length
      })
      report('graph_node', phases)
    }
    graphResult = await backfillUnembeddedGraphNodes({
      vaultId,
      listUnembeddedLiveNodes: async () => liveUnembedded,
      updateNodeEmbedding: (id, vid, embedding, modelId) =>
        graphRepo.updateNodeEmbedding(id, vid, embedding, modelId),
      embedQuery: (text) => adapter.embedQuery(text),
      modelId: adapter.embeddingModelId ?? '',
      onBeforeItem: () => assertBatchEmbedCanContinue(),
      onProgress: ({ completed, total }) => {
        report(
          'graph_node',
          patchPhaseCounts(phases, 'graph_node', {
            completed,
            total: liveUnembedded.length || total
          })
        )
        if (completed % 8 === 0) {
          invalidatePendingEmbedCountsCache()
        }
      }
    })
  } catch (error) {
    if (isBatchEmbedAbortedError(error) || isEmbedApiUnavailableError(error)) throw error
    logger.warn('[PendingEmbedFill] graph node fill failed', error as Error)
  }
  phases = markPhaseDone(
    patchPhaseCounts(phases, 'graph_node', {
      completed: graphResult.updated + graphResult.failed,
      total: Math.max(graphResult.total, phases.graphNodes.total)
    }),
    'graph_node'
  )

  try {
    await assertBatchEmbedCanContinue()
    const { runDesktopGraphSuspectScan } = await import('./graph-suspect-scan.service')
    const graphRepo = new GraphRepository(drizzleDb)
    report(
      'graph_disambiguate',
      patchPhaseCounts(phases, 'graph_disambiguate', { completed: 0, total: 1 })
    )
    const scanResult = await runDesktopGraphSuspectScan({
      vaultId,
      repo: graphRepo,
      onProgress: ({ completed, total }) => {
        report(
          'graph_disambiguate',
          patchPhaseCounts(phases, 'graph_disambiguate', {
            completed,
            total: Math.max(total, 1)
          })
        )
      }
    })
    phases = markPhaseDone(
      patchPhaseCounts(phases, 'graph_disambiguate', {
        completed: scanResult.persisted,
        total: Math.max(scanResult.collected, scanResult.persisted, 1)
      }),
      'graph_disambiguate'
    )
    if (scanResult.persisted > 0) {
      notifyPendingEmbedCountsChanged()
    }
  } catch (error) {
    if (isBatchEmbedAbortedError(error)) throw error
    logger.warn('[PendingEmbedFill] graph disambiguate phase failed', error as Error)
    phases = markPhaseDone(phases, 'graph_disambiguate')
  }

  invalidatePendingEmbedCountsCache()
  report('finishing', phases)
  return {
    graphUpdated: graphResult.updated,
    graphFailed: graphResult.failed,
    graphTotal: graphResult.total
  }
}
