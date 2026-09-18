import i18n from 'i18next'
import { EmbeddingAdapter } from '@baishou/ai'
import { backfillUnembeddedGraphNodes, MemorySyncService } from '@baishou/core-mobile'
import { GraphRepository } from '@baishou/database'
import {
  logger,
  markPhaseDone,
  overallFromPhaseCounts,
  patchPhaseCounts,
  phaseCountsFromPending,
  probeEmbeddingApi,
  type PendingEmbedCounts,
  type RagBatchEmbedPhaseCounts,
  type RagBatchEmbedPhaseKind
} from '@baishou/shared'
import { MobileRagAbortError, assertMobileRagCanContinue } from './mobile-rag-operation-control'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import {
  consumeMobileKnowledgeGraphJobs,
  consumeMobileKnowledgeIngestJobs
} from './mobile-knowledge-ingest-jobs.consumer'
import { mobileGraphExtractQueue } from './mobile-graph-extract-queue.service'
import { invalidateMobilePendingEmbedCountsCache } from './mobile-pending-embed-counts'
import type { MobileRagServiceDeps } from './mobile-rag-core.helpers'
import { resolveVaultScope } from './mobile-rag-core.helpers'
import {
  createMobileMemoryEmbedSink,
  getMobileMemoryRawManager
} from './mobile-raw-data-source.runtime'

export type MobilePendingEmbedFillProgress = {
  completed: number
  total: number
  statusText: string
  phase: RagBatchEmbedPhaseKind
  phases: RagBatchEmbedPhaseCounts
}

export type MobilePendingEmbedFillResult = {
  graphUpdated: number
  graphFailed: number
  graphTotal: number
  skippedReason?: 'no-vault' | 'adapter-unavailable' | 'nothing-to-embed'
}

type OrganizeFillCounts = Pick<
  PendingEmbedCounts,
  'diaries' | 'memories' | 'graphNodes' | 'knowledgeSources' | 'notebookGraphNodes' | 'total'
> & { graphExtract?: number; graphDisambiguate?: number }

function pendingAsideDiary(counts?: OrganizeFillCounts): number | null {
  if (!counts) return null
  return (
    counts.memories +
    counts.graphNodes +
    counts.knowledgeSources +
    counts.notebookGraphNodes +
    (counts.graphExtract ?? 0) +
    (counts.graphDisambiguate ?? 0)
  )
}

export async function runMobileManualPendingEmbedFill(
  deps: MobileRagServiceDeps,
  options?: {
    onProgress?: (progress: MobilePendingEmbedFillProgress) => void
    counts?: OrganizeFillCounts
  }
): Promise<MobilePendingEmbedFillResult> {
  const empty: MobilePendingEmbedFillResult = { graphUpdated: 0, graphFailed: 0, graphTotal: 0 }
  const vaultScope = await resolveVaultScope(deps)
  const vaultId = await vaultScope.resolveActiveVaultId()
  if (!vaultId) return { ...empty, skippedReason: 'no-vault' }

  const counts =
    options?.counts ??
    (await import('./mobile-pending-embed-counts')
      .then((mod) => mod.getOrganizePendingSnapshot(deps))
      .catch(() => undefined))
  const asideDiary = pendingAsideDiary(counts)

  const adapter = await resolveMobileFillAdapter(deps)
  if (!adapter?.isConfigured) {
    return {
      ...empty,
      skippedReason: asideDiary === 0 ? 'nothing-to-embed' : 'adapter-unavailable'
    }
  }

  const probe = await probeEmbeddingApi((text) => adapter.embedQuery(text))
  if (!probe.ok) {
    throw new Error(probe.message)
  }

  let phases = markPhaseDone(
    phaseCountsFromPending({
      diaries: counts?.diaries ?? 0,
      memories: counts?.memories ?? 0,
      graphNodes: counts?.graphNodes ?? 0,
      knowledgeSources: counts?.knowledgeSources ?? 0,
      notebookGraphNodes: counts?.notebookGraphNodes ?? 0,
      graphExtract: counts?.graphExtract ?? 0,
      graphDisambiguate: counts?.graphDisambiguate ?? 0
    }),
    'diary'
  )

  const report = (phase: RagBatchEmbedPhaseKind, next: RagBatchEmbedPhaseCounts) => {
    phases = next
    const overall = overallFromPhaseCounts(phases)
    const statusText =
      phase === 'memory'
        ? i18n.t('settings.rag_indexing_memory', '正在嵌入伙伴记忆…')
        : phase === 'knowledge'
          ? i18n.t('settings.rag_indexing_knowledge', '正在嵌入知识库…')
          : phase === 'graph_extract'
            ? i18n.t('settings.rag_indexing_graph_extract', '正在整理关系图谱…')
            : phase === 'graph_node'
              ? i18n.t('settings.rag_indexing_graph_node', '正在嵌入图谱节点…')
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

  await assertMobileRagCanContinue()

  if (phases.memories.total > 0) {
    report('memory', phases)
  }
  try {
    const memoryManager = getMobileMemoryRawManager()
    if (memoryManager) {
      const sync = new MemorySyncService(
        memoryManager,
        createMobileMemoryEmbedSink(deps.hsRepo, adapter)
      )
      await sync.syncPendingIndex({ vaultId, embedMissing: true })
    }
  } catch (error) {
    if (error instanceof MobileRagAbortError) throw error
    logger.warn('[PendingEmbedFill] mobile memory fill failed', error as Error)
  }
  phases = markPhaseDone(phases, 'memory')

  let knowledgeDone = 0
  if (phases.knowledgeSources.total > 0) {
    report('knowledge', phases)
  }
  try {
    await assertMobileRagCanContinue()
    const { expoKnowledgeConnectionManager, KnowledgeRepository } =
      await import('@baishou/database/expo')
    if (expoKnowledgeConnectionManager.isConnected()) {
      const repo = new KnowledgeRepository(expoKnowledgeConnectionManager.getDb())
      const pending = await repo.listPendingEmbedSources(vaultId, {
        modelId: adapter.embeddingModelId
      })
      phases = patchPhaseCounts(phases, 'knowledge', { total: pending.length })
      if (pending.length > 0) {
        report('knowledge', phases)
      }
      for (const source of pending) {
        await assertMobileRagCanContinue()
        await repo.enqueueIngestJob({
          notebookId: source.notebookId,
          sourceId: source.id,
          stage: 'embed',
          vaultId: source.vaultId || vaultId
        })
      }
      if (pending.length > 0) {
        for (let i = 0; i < 20; i += 1) {
          await assertMobileRagCanContinue()
          const result = await consumeMobileKnowledgeIngestJobs({
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
    if (error instanceof MobileRagAbortError) throw error
    logger.warn('[PendingEmbedFill] mobile knowledge fill failed', error as Error)
  }
  phases = markPhaseDone(phases, 'knowledge')

  let extractDone = 0
  try {
    await assertMobileRagCanContinue()
    let extractTotal = phases.graphExtract.total
    for (let i = 0; i < 20; i += 1) {
      await assertMobileRagCanContinue()
      const result = await consumeMobileKnowledgeGraphJobs({
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
    invalidateMobilePendingEmbedCountsCache()
    const queued = await mobileGraphExtractQueue.enqueue({})
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
    if (mobileGraphExtractQueue.isRunning || queued.queued > 0) {
      await mobileGraphExtractQueue.waitUntilIdle({
        shouldContinue: async () => {
          try {
            await assertMobileRagCanContinue()
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
    if (error instanceof MobileRagAbortError) throw error
    logger.warn('[PendingEmbedFill] mobile graph extract phase failed', error as Error)
  }
  phases = markPhaseDone(phases, 'graph_extract')

  // 抽图会新建节点；结束后再补仍为空的向量，避免抽图前写入旧空位。日记为 0 也不跳过这一段。
  let graphResult = { updated: 0, failed: 0, total: 0 }
  try {
    await assertMobileRagCanContinue()
    const drizzleDb = agentDbRuntimeRef.current?.drizzleDb
    const liveUnembedded = drizzleDb
      ? await new GraphRepository(drizzleDb).listUnembeddedLiveNodes(vaultId)
      : []
    const { expoKnowledgeConnectionManager, NotebookGraphRepository } =
      await import('@baishou/database/expo')
    const notebookUnembedded = expoKnowledgeConnectionManager.isConnected()
      ? await new NotebookGraphRepository(
          expoKnowledgeConnectionManager.getDb()
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
    if (drizzleDb) {
      const graphRepo = new GraphRepository(drizzleDb)
      graphResult = await backfillUnembeddedGraphNodes({
        vaultId,
        listUnembeddedLiveNodes: async () => liveUnembedded,
        updateNodeEmbedding: (id, vid, embedding, modelId) =>
          graphRepo.updateNodeEmbedding(id, vid, embedding, modelId),
        embedQuery: (text) => adapter.embedQuery(text),
        modelId: adapter.embeddingModelId ?? '',
        onBeforeItem: () => assertMobileRagCanContinue(),
        onProgress: ({ completed, total }) => {
          report(
            'graph_node',
            patchPhaseCounts(phases, 'graph_node', {
              completed,
              total: combinedTotal || total
            })
          )
          if (completed % 8 === 0) {
            invalidateMobilePendingEmbedCountsCache()
          }
        }
      })
    }
    if (notebookUnembedded.length > 0) {
      const notebookRepo = new NotebookGraphRepository(expoKnowledgeConnectionManager.getDb())
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
        onBeforeItem: () => assertMobileRagCanContinue(),
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
    } else {
      graphResult = { ...graphResult, total: combinedTotal }
    }
  } catch (error) {
    if (error instanceof MobileRagAbortError) throw error
    logger.warn('[PendingEmbedFill] mobile graph node fill failed', error as Error)
  }
  phases = markPhaseDone(
    patchPhaseCounts(phases, 'graph_node', {
      completed: graphResult.updated + graphResult.failed,
      total: Math.max(graphResult.total, phases.graphNodes.total)
    }),
    'graph_node'
  )

  let scanCollected = 0
  try {
    await assertMobileRagCanContinue()
    const { runMobileGraphSuspectScan } = await import('./mobile-graph-suspect-scan')
    report(
      'graph_disambiguate',
      patchPhaseCounts(phases, 'graph_disambiguate', { completed: 0, total: 1 })
    )
    const scanResult = await runMobileGraphSuspectScan({ vaultId })
    scanCollected = scanResult.collected
    phases = markPhaseDone(
      patchPhaseCounts(phases, 'graph_disambiguate', {
        completed: scanResult.persisted,
        total: Math.max(scanResult.collected, scanResult.persisted, 1)
      }),
      'graph_disambiguate'
    )
  } catch (error) {
    if (error instanceof MobileRagAbortError) throw error
    logger.warn('[PendingEmbedFill] mobile graph disambiguate phase failed', error as Error)
    phases = markPhaseDone(phases, 'graph_disambiguate')
  }

  invalidateMobilePendingEmbedCountsCache()
  report('finishing', phases)
  const discovered = graphResult.total + knowledgeDone + extractDone + scanCollected
  if (asideDiary === 0 && discovered === 0) {
    return { ...empty, skippedReason: 'nothing-to-embed' }
  }
  return {
    graphUpdated: graphResult.updated,
    graphFailed: graphResult.failed,
    graphTotal: graphResult.total
  }
}

async function resolveMobileFillAdapter(
  deps: MobileRagServiceDeps
): Promise<EmbeddingAdapter | null> {
  const { resolveMobileEmbeddingForHydration } = await import('./mobile-raw-data-source.runtime')
  const emb = await resolveMobileEmbeddingForHydration(deps.settingsManager)
  if (!emb.embeddingProvider || !emb.embeddingModelId) return null
  return new EmbeddingAdapter(emb.embeddingProvider, emb.embeddingModelId, deps.hsRepo)
}
