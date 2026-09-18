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
  KnowledgeRepository,
  knowledgeConnectionManager,
  NotebookGraphRepository,
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
import {
  consumeKnowledgeGraphJobs,
  consumeKnowledgeIngestJobs
} from './knowledge-ingest-jobs.consumer'
import { syncMemoryPendingIndex } from './raw-data-source.runtime'
import { invalidatePendingEmbedCountsCache } from './pending-embed-counts.service'
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
  counts?: Pick<
    PendingEmbedCounts,
    'diaries' | 'memories' | 'graphNodes' | 'knowledgeSources' | 'notebookGraphNodes' | 'total'
  > & { graphExtract?: number }
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
      knowledgeSources: options?.counts?.knowledgeSources ?? 0,
      notebookGraphNodes: options?.counts?.notebookGraphNodes ?? 0,
      graphExtract: options?.counts?.graphExtract ?? 0
    }),
    'diary'
  )

  const report = (phase: RagBatchEmbedPhaseKind, next: RagBatchEmbedPhaseCounts) => {
    phases = next
    const overall = overallFromPhaseCounts(phases)
    const statusText =
      phase === 'memory'
        ? '正在嵌入伙伴记忆…'
        : phase === 'graph_node'
          ? '正在嵌入图谱节点…'
          : phase === 'knowledge'
            ? '正在嵌入知识库…'
            : phase === 'graph_extract'
              ? '正在整理关系图谱…'
              : '正在完成索引…'
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

  let graphResult = { updated: 0, failed: 0, total: 0 }
  try {
    await assertBatchEmbedCanContinue()
    const graphRepo = new GraphRepository(drizzleDb)
    const liveUnembedded = await graphRepo.listUnembeddedLiveNodes(vaultId)
    const notebookUnembedded = knowledgeConnectionManager.isConnected()
      ? await new NotebookGraphRepository(
          knowledgeConnectionManager.getDb()
        ).listUnembeddedLiveNodes(vaultId)
      : []
    const notebookById = new Map(notebookUnembedded.map((row) => [row.id, row]))
    const combinedTotal = liveUnembedded.length + notebookUnembedded.length
    if (combinedTotal > 0) {
      phases = patchPhaseCounts(phases, 'graph_node', {
        completed: 0,
        total: combinedTotal
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
            total: combinedTotal || total
          })
        )
        if (completed % 8 === 0) {
          invalidatePendingEmbedCountsCache()
        }
      }
    })
    if (notebookUnembedded.length > 0) {
      const notebookRepo = new NotebookGraphRepository(knowledgeConnectionManager.getDb())
      const notebookResult = await backfillUnembeddedGraphNodes({
        vaultId,
        listUnembeddedLiveNodes: async () => notebookUnembedded,
        updateNodeEmbedding: (id, vid, embedding, modelId) => {
          const row = notebookById.get(id)
          if (!row) return Promise.resolve()
          return notebookRepo.updateNodeEmbedding(id, vid, row.notebookId, embedding, modelId)
        },
        embedQuery: (text) => adapter.embedQuery(text),
        modelId: adapter.embeddingModelId ?? '',
        onBeforeItem: () => assertBatchEmbedCanContinue(),
        onProgress: ({ completed }) => {
          report(
            'graph_node',
            patchPhaseCounts(phases, 'graph_node', {
              completed: graphResult.updated + graphResult.failed + completed,
              total: combinedTotal
            })
          )
        }
      })
      graphResult = {
        updated: graphResult.updated + notebookResult.updated,
        failed: graphResult.failed + notebookResult.failed,
        total: combinedTotal
      }
    }
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

  if (phases.knowledgeSources.total > 0) {
    report('knowledge', phases)
  }
  try {
    await assertBatchEmbedCanContinue()
    if (knowledgeConnectionManager.isConnected()) {
      const repo = new KnowledgeRepository(knowledgeConnectionManager.getDb())
      const pending = await repo.listPendingEmbedSources(vaultId, {
        modelId: adapter.embeddingModelId
      })
      phases = patchPhaseCounts(phases, 'knowledge', { total: pending.length })
      if (pending.length > 0) {
        report('knowledge', phases)
      }
      for (const source of pending) {
        await assertBatchEmbedCanContinue()
        await repo.enqueueIngestJob({
          notebookId: source.notebookId,
          sourceId: source.id,
          stage: 'embed',
          vaultId: source.vaultId || vaultId
        })
      }
      if (pending.length > 0) {
        let knowledgeDone = 0
        for (let i = 0; i < 20; i += 1) {
          await assertBatchEmbedCanContinue()
          const result = await consumeKnowledgeIngestJobs({
            reason: 'manual-pending-fill',
            limit: 10
          })
          if (!result.processed) break
          knowledgeDone += result.processed
          report(
            'knowledge',
            patchPhaseCounts(phases, 'knowledge', {
              completed: knowledgeDone,
              total: pending.length
            })
          )
        }
      }
    }
  } catch (error) {
    if (isBatchEmbedAbortedError(error)) throw error
    logger.warn('[PendingEmbedFill] knowledge fill failed', error as Error)
  }
  phases = markPhaseDone(phases, 'knowledge')

  try {
    await assertBatchEmbedCanContinue()
    let extractDone = 0
    let extractTotal = phases.graphExtract.total

    if (knowledgeConnectionManager.isConnected()) {
      for (let i = 0; i < 20; i += 1) {
        await assertBatchEmbedCanContinue()
        const result = await consumeKnowledgeGraphJobs({
          reason: 'manual-pending-fill',
          limit: 10
        })
        if (!result.processed) break
        extractDone += result.processed
        extractTotal = Math.max(extractTotal, extractDone)
        report(
          'graph_extract',
          patchPhaseCounts(phases, 'graph_extract', {
            completed: extractDone,
            total: extractTotal
          })
        )
      }
    }

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

  invalidatePendingEmbedCountsCache()
  report('finishing', phases)
  return {
    graphUpdated: graphResult.updated,
    graphFailed: graphResult.failed,
    graphTotal: graphResult.total
  }
}
