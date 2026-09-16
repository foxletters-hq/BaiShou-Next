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
import { consumeKnowledgeIngestJobs } from './knowledge-ingest-jobs.consumer'
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
    'diaries' | 'memories' | 'graphNodes' | 'knowledgeSources' | 'total'
  >
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
      knowledgeSources: options?.counts?.knowledgeSources ?? 0
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
          patchPhaseCounts(phases, 'graph_node', { completed, total })
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

  invalidatePendingEmbedCountsCache()
  report('finishing', phases)
  return {
    graphUpdated: graphResult.updated,
    graphFailed: graphResult.failed,
    graphTotal: graphResult.total
  }
}
