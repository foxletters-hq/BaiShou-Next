import i18n from 'i18next'
import { EmbeddingAdapter } from '@baishou/ai'
import { backfillUnembeddedGraphNodes, MemorySyncService } from '@baishou/core-mobile'
import { GraphRepository, ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import {
  describeGraphExtractPhase,
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
import { createMobileFileSystem } from './create-mobile-file-system'
import { mobileGraphExtractQueue } from './mobile-graph-extract-queue.service'
import {
  invalidateMobilePendingEmbedCountsCache,
  notifyMobilePendingEmbedCountsChanged
} from './mobile-pending-embed-counts'
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
  'diaries' | 'memories' | 'graphNodes' | 'knowledgeSources' | 'total'
> & {
  graphExtract?: number
  graphDisambiguate?: number
}

function pendingAsideDiary(counts?: OrganizeFillCounts): number | null {
  if (!counts) return null
  return (
    counts.memories +
    counts.graphNodes +
    (counts.graphExtract ?? 0) +
    (counts.graphDisambiguate ?? 0)
  )
}

export async function bindGraphExtractQueueContext(
  deps: MobileRagServiceDeps,
  vaultId: string
): Promise<void> {
  const runtime = agentDbRuntimeRef.current
  if (!runtime?.drizzleDb) return
  const vaultScope = await resolveVaultScope(deps)
  const vaultName = await vaultScope.resolveActiveVaultName()
  mobileGraphExtractQueue.setContext({
    vaultId,
    vaultName,
    drizzleDb: runtime.drizzleDb,
    shadowRepo: new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId),
    pathService: runtime.pathService,
    fileSystem: createMobileFileSystem(),
    settingsManager: runtime.settingsManager
  })
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
      graphExtract: counts?.graphExtract ?? 0,
      graphDisambiguate: counts?.graphDisambiguate ?? 0
    }),
    'diary'
  )

  function resolveGraphExtractItemDateOrTitle(item: { date?: string; filePath?: string }): string {
    if (item.date?.trim()) return item.date.trim()
    const raw = item.filePath || ''
    const match = raw.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/)
    if (match) return match[1]
    const base = raw.split(/[/\\]/).pop() || raw
    return base.replace(/\.md$/i, '')
  }

  const report = (
    phase: RagBatchEmbedPhaseKind,
    next: RagBatchEmbedPhaseCounts,
    customStatusText?: string
  ) => {
    phases = next
    const overall = overallFromPhaseCounts(phases)
    const statusText =
      customStatusText ??
      (phase === 'memory'
        ? i18n.t('settings.rag_indexing_memory', '正在嵌入伙伴记忆…')
        : phase === 'graph_extract'
          ? i18n.t('settings.rag_indexing_graph_extract', '正在整理关系图谱…')
          : phase === 'graph_node'
            ? i18n.t('settings.rag_indexing_graph_node', '正在嵌入图谱节点…')
            : phase === 'graph_disambiguate'
              ? i18n.t('settings.rag_indexing_graph_disambiguate', '正在复核可疑图谱节点…')
              : i18n.t('settings.rag_batch_embed_finishing', '正在完成索引…'))
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

  let extractQueued = 0
  let extractCompleted = 0
  try {
    await assertMobileRagCanContinue()
    let extractTotal = phases.graphExtract.total
    invalidateMobilePendingEmbedCountsCache()
    await bindGraphExtractQueueContext(deps, vaultId)
    const queued = await mobileGraphExtractQueue.enqueue({})
    extractQueued = queued.totalPending
    extractTotal = Math.max(extractTotal, queued.totalPending)
    if (extractTotal > 0) {
      report(
        'graph_extract',
        patchPhaseCounts(phases, 'graph_extract', {
          completed: 0,
          total: extractTotal
        }),
        i18n.t('graph.extract_progress_starting', '正在开始整理关系图谱')
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
          extractCompleted = state.completedCount + state.errorCount
          const totalCount = Math.max(extractTotal, state.items.length)
          const activeItem = state.items.find(
            (it) => it.status === 'running' || it.status === 'aligning'
          )
          let customStatus: string | undefined
          if (activeItem) {
            const itemLabel = resolveGraphExtractItemDateOrTitle(activeItem)
            const phaseDesc = describeGraphExtractPhase(activeItem)
            const phaseLabel = i18n.t(phaseDesc.key, phaseDesc.defaultValue, phaseDesc.params)
            customStatus = i18n.t('graph.extract_item_detail', '正在整理 {{item}} · {{phase}}', {
              item: itemLabel,
              phase: phaseLabel
            })
          }
          report(
            'graph_extract',
            patchPhaseCounts(phases, 'graph_extract', {
              completed: extractCompleted,
              total: totalCount
            }),
            customStatus
          )
        }
      })
    }
    // 取消后 waitUntilIdle 会直接返回而不抛错，这里补一次检查，
    // 让下面的 catch 停掉仍在后台跑的抽图队列。
    await assertMobileRagCanContinue()
  } catch (error) {
    if (error instanceof MobileRagAbortError) {
      mobileGraphExtractQueue.stop()
      throw error
    }
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
    if (liveUnembedded.length > 0) {
      phases = patchPhaseCounts(phases, 'graph_node', {
        completed: 0,
        total: liveUnembedded.length
      })
      report(
        'graph_node',
        phases,
        i18n.t(
          'settings.rag_indexing_graph_node_progress',
          '正在嵌入图谱节点（{{completed}}/{{total}}）',
          {
            completed: 0,
            total: liveUnembedded.length
          }
        )
      )
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
          const nodeTotal = liveUnembedded.length || total
          report(
            'graph_node',
            patchPhaseCounts(phases, 'graph_node', {
              completed,
              total: nodeTotal
            }),
            i18n.t(
              'settings.rag_indexing_graph_node_progress',
              '正在嵌入图谱节点（{{completed}}/{{total}}）',
              { completed, total: nodeTotal }
            )
          )
          if (completed % 8 === 0) {
            invalidateMobilePendingEmbedCountsCache()
          }
        }
      })
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

  invalidateMobilePendingEmbedCountsCache()
  report('finishing', phases)
  const discovered = graphResult.total + Math.max(extractCompleted, extractQueued)
  if (asideDiary === 0 && discovered === 0) {
    return { ...empty, skippedReason: 'nothing-to-embed' }
  }
  notifyMobilePendingEmbedCountsChanged()
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
