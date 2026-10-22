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
  describeGraphExtractPhase,
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
  > & {
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
      knowledgeSources: options?.counts?.knowledgeSources ?? 0,
      graphExtract: options?.counts?.graphExtract ?? 0,
      graphDisambiguate: options?.counts?.graphDisambiguate ?? 0
    }),
    'diary'
  )

  function resolveGraphExtractItemDateOrTitle(item: { date?: string; filePath?: string }): string {
    if (item.date?.trim()) return item.date.trim()
    const raw = item.filePath || ''
    const match = raw.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/)
    if (match) return match[1]!
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
        : phase === 'graph_node'
          ? i18n.t('settings.rag_indexing_graph_node', '正在嵌入图谱节点…')
          : phase === 'graph_extract'
            ? i18n.t('settings.rag_indexing_graph_extract', '正在整理关系图谱…')
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

  if (phases.memories.total > 0) {
    report('memory', phases)
  }
  try {
    await assertBatchEmbedCanContinue()
    await syncMemoryPendingIndex({
      hsRepo,
      embeddingAdapter: adapter,
      vaultId,
      embedMissing: true,
      onBeforeItem: () => assertBatchEmbedCanContinue()
    })
  } catch (error) {
    if (isBatchEmbedAbortedError(error)) throw error
    logger.warn('[PendingEmbedFill] memory fill failed', error as Error)
    throw error
  }
  phases = markPhaseDone(phases, 'memory')

  try {
    await assertBatchEmbedCanContinue()
    const extractDone = 0
    let extractTotal = phases.graphExtract.total

    const { GraphExtractQueueService } = await import('./graph-extract-queue.service')
    const { enqueueGraphExtract } = await import('../ipc/graph.ipc')
    const extractQueue = GraphExtractQueueService.getInstance()
    try {
      const preState = extractQueue.getQueueState()
      if (preState.lastError) {
        throw new Error(preState.lastError)
      }
      invalidatePendingEmbedCountsCache()
      const queued = await enqueueGraphExtract(extractQueue)
      extractTotal = Math.max(extractTotal, extractDone + queued.totalPending)
      if (extractTotal > 0) {
        report(
          'graph_extract',
          patchPhaseCounts(phases, 'graph_extract', {
            completed: extractDone,
            total: extractTotal
          }),
          i18n.t('graph.extract_progress_starting', '正在开始整理关系图谱')
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
            const nextTotal = Math.max(extractTotal, extractDone + state.items.length)
            const completed = Math.min(
              nextTotal,
              extractDone + state.completedCount + (state.aligningCount ?? 0)
            )
            const activeItems = state.items.filter(
              (it) => it.status === 'running' || it.status === 'aligning'
            )
            const activeItem =
              activeItems.find(
                (it) =>
                  it.phase === 'recalling' ||
                  it.phase === 'waiting_align' ||
                  it.phase === 'aligning' ||
                  it.phase === 'writing'
              ) ??
              activeItems.find((it) => it.status === 'running' && it.phaseDetail) ??
              activeItems.find((it) => it.status === 'running') ??
              activeItems[0]
            let customStatus: string | undefined
            if (activeItem) {
              const itemLabel = resolveGraphExtractItemDateOrTitle(activeItem)
              const phaseDesc = describeGraphExtractPhase(activeItem)
              const phaseLabel = i18n.t(phaseDesc.key, phaseDesc.defaultValue, phaseDesc.params)
              const retrySuffix =
                (activeItem.retryCount ?? 0) > 0 ? `（重试 ${activeItem.retryCount}/3）` : ''
              customStatus = i18n.t('graph.extract_item_detail', '正在整理 {{item}} · {{phase}}', {
                item: itemLabel,
                phase: `${phaseLabel}${retrySuffix}`
              })
            }
            report(
              'graph_extract',
              patchPhaseCounts(phases, 'graph_extract', {
                completed,
                total: nextTotal
              }),
              customStatus
            )
          }
        })
      }
      // 取消后 waitUntilIdle 会直接返回而不抛错，这里补一次检查，
      // 让下面的 catch 停掉仍在后台跑的抽图队列。
      await assertBatchEmbedCanContinue()
      const finalState = extractQueue.getQueueState()
      if (finalState.lastError || finalState.errorCount > 0) {
        throw new Error(
          finalState.lastError ||
            i18n.t('settings.rag_graph_extract_failed', '关系图谱抽取失败，请检查模型配置后重试')
        )
      }
      if (!queued.blockedPendingEmbed) {
        phases = markPhaseDone(phases, 'graph_extract')
      }
    } catch (error) {
      if (isBatchEmbedAbortedError(error)) {
        extractQueue.stop()
        throw error
      }
      logger.warn('[PendingEmbedFill] diary graph extract failed', error as Error)
      throw error
    }
  } catch (error) {
    if (isBatchEmbedAbortedError(error)) throw error
    logger.warn('[PendingEmbedFill] graph extract phase failed', error as Error)
    throw error
  }

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
    graphResult = await backfillUnembeddedGraphNodes({
      vaultId,
      concurrency: 4,
      listUnembeddedLiveNodes: async () => liveUnembedded,
      updateNodeEmbedding: (id, vid, embedding, modelId) =>
        graphRepo.updateNodeEmbedding(id, vid, embedding, modelId),
      updateNodeEmbeddingsBatch: (vid, modelId, items) =>
        graphRepo.updateNodeEmbeddingsBatch(vid, modelId, items),
      embedBatch:
        typeof adapter.embedBatch === 'function'
          ? async (texts) => {
              const maxRetries = 1
              let lastErr: unknown
              for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                  const vecs = await adapter.embedBatch(texts)
                  if (vecs?.some((v) => v?.length)) return vecs
                } catch (err) {
                  lastErr = err
                }
                if (attempt < maxRetries) {
                  await assertBatchEmbedCanContinue()
                }
              }
              if (lastErr) throw lastErr
              return texts.map(() => null)
            }
          : undefined,
      embedQuery: async (text) => {
        const maxRetries = 1
        let lastErr: unknown
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const vec = await adapter.embedQuery(text)
            if (vec?.length) return vec
          } catch (err) {
            lastErr = err
          }
          if (attempt < maxRetries) {
            await assertBatchEmbedCanContinue()
          }
        }
        if (lastErr) throw lastErr
        return null
      },
      modelId: adapter.embeddingModelId ?? '',
      onBeforeItem: () => assertBatchEmbedCanContinue(),
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
      }
    })
  } catch (error) {
    if (isBatchEmbedAbortedError(error) || isEmbedApiUnavailableError(error)) throw error
    logger.warn('[PendingEmbedFill] graph node fill failed', error as Error)
    throw error
  }
  phases = markPhaseDone(
    patchPhaseCounts(phases, 'graph_node', {
      completed: graphResult.updated,
      total: Math.max(graphResult.total, phases.graphNodes.total)
    }),
    'graph_node'
  )

  invalidatePendingEmbedCountsCache()
  report('finishing', phases)
  return {
    graphUpdated: graphResult.updated,
    graphFailed: graphResult.failed,
    graphTotal: graphResult.total
  }
}
