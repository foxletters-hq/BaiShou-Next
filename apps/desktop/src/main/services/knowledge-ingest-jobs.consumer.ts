import { BrowserWindow } from 'electron'
import {
  clampOcrConcurrency,
  logger,
  isVisionModel,
  type GlobalModelsConfig,
  type KnowledgeConfig,
  type AIProviderConfig
} from '@baishou/shared'
import { KnowledgeRepository, knowledgeConnectionManager } from '@baishou/database-desktop'
import { KnowledgeEmbeddingStorage } from '@baishou/ai'
import {
  KnowledgeIngestService,
  markEmbedJobLive,
  markExtractJobLive,
  markGraphJobLive,
  unmarkEmbedJobLive,
  unmarkExtractJobLive,
  unmarkGraphJobLive,
  type KnowledgeExtractProgress
} from '@baishou/core-desktop'
import { getNotebookRawManager } from './raw-data-source.runtime'
import { fileSystem } from './node-file-system'

type IngestLane = 'index' | 'graph'
type ConsumeResult = { processed: number; failed: number; skipped?: string }

const INDEX_STAGES = ['extract', 'embed'] as const
const GRAPH_STAGES = ['graph'] as const

const laneInFlight: Record<IngestLane, Promise<ConsumeResult> | null> = {
  index: null,
  graph: null
}

function stagesForLane(lane: IngestLane): Array<(typeof INDEX_STAGES)[number] | (typeof GRAPH_STAGES)[number]> {
  return lane === 'index' ? [...INDEX_STAGES] : [...GRAPH_STAGES]
}

function broadcastKnowledgeOcrProgress(info: KnowledgeExtractProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    try {
      win.webContents.send('knowledge:ocr-progress', info)
    } catch {
      /* ignore */
    }
  }
}

function broadcastKnowledgeGraphProgress(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    try {
      win.webContents.send('knowledge:graph-progress', { at: Date.now() })
    } catch {
      /* ignore */
    }
  }
}

async function buildServiceWithEmbedding(): Promise<KnowledgeIngestService | null> {
  if (!knowledgeConnectionManager.isConnected()) {
    return null
  }

  const { getEmbeddingService, getEmbeddingConfig } = await import('../ipc/rag.ipc')
  const { resolveActiveVaultId } = await import('../ipc/vault.ipc')
  const embeddingService = getEmbeddingService()
  const embeddingConfig = getEmbeddingConfig()
  await embeddingConfig.load()

  const repo = new KnowledgeRepository(knowledgeConnectionManager.getDb())
  const notebookManager = getNotebookRawManager()
  const storage = new KnowledgeEmbeddingStorage(() => repo)

  return new KnowledgeIngestService({
    repo,
    notebookManager,
    fs: fileSystem,
    getVaultId: () => resolveActiveVaultId(),
    onExtractProgress: broadcastKnowledgeOcrProgress,
    getExtractConfig: async () => {
      const { settingsManager } = await import('../ipc/settings.ipc')
      const raw = (await settingsManager.get<KnowledgeConfig>('knowledge_config')) || {}
      const cfg = {
        defaultExtractEngine: 'simple' as const,
        ocrLanguage: 'chi_sim+eng',
        ocrDpi: 250,
        ocrConcurrency: 1,
        multiQueryAsk: false,
        ...raw
      }
      const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
      const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
      const modelId =
        cfg.visionModelId ||
        globalModels?.globalDialogueModelId ||
        globalModels?.globalSummaryModelId ||
        null
      const providerId =
        cfg.visionProviderId ||
        globalModels?.globalDialogueProviderId ||
        globalModels?.globalSummaryProviderId ||
        null
      const provider =
        (providerId ? providers.find((p) => p.id === providerId) : undefined) ||
        providers.find((p) => p.isEnabled)
      const visionConfigured = Boolean(
        modelId && isVisionModel(modelId, provider?.type || provider?.id)
      )
      return {
        defaultEngine: cfg.defaultExtractEngine,
        ocrLanguage: cfg.ocrLanguage,
        ocrDpi: cfg.ocrDpi,
        ocrConcurrency: clampOcrConcurrency(cfg.ocrConcurrency),
        visionModelConfigured: visionConfigured,
        visionModelId: modelId
      }
    },
    embedding: {
      isConfigured: embeddingService.isConfigured,
      getModelId: () => embeddingConfig.getGlobalEmbeddingModelId(),
      getProviderInstance: () => embeddingConfig.getProviderInstance()
    },
    insertChunk: async (params) => {
      await storage.insertEmbedding({
        id: params.chunkId,
        sourceType: 'knowledge',
        sourceId: params.sourceId,
        groupId: params.notebookId,
        vaultId: params.vaultId,
        chunkIndex: params.chunkIndex,
        chunkText: params.chunkText,
        metadataJson: params.metadataJson,
        embedding: params.embedding,
        modelId: params.modelId
      })
    },
    deleteChunksBySource: (id) => repo.deleteChunksBySource(id),
    extractNotebookGraph: (await import('./desktop-knowledge-graph-extract')).createDesktopKnowledgeGraphExtractFn()
  })
}

/**
 * 消费知识库摄入欠账。提取/嵌入与图谱分车道，避免图谱 LLM 堵住 PDF 嵌入。
 */
export async function consumeKnowledgeIngestJobs(options?: {
  limit?: number
  reason?: string
}): Promise<ConsumeResult> {
  return consumeKnowledgeLane('index', options)
}

async function consumeKnowledgeLane(
  lane: IngestLane,
  options?: {
    limit?: number
    reason?: string
  }
): Promise<ConsumeResult> {
  const existing = laneInFlight[lane]
  if (existing) return existing

  const stages = stagesForLane(lane)
  const run = (async () => {
    if (!knowledgeConnectionManager.isConnected()) {
      return { processed: 0, failed: 0, skipped: 'db-not-connected' }
    }

    const repo = new KnowledgeRepository(knowledgeConnectionManager.getDb())
    const svc = await buildServiceWithEmbedding()
    if (!svc) {
      return { processed: 0, failed: 0, skipped: 'service-unavailable' }
    }

    try {
      const recovered = await svc.recoverStaleIngestState()
      if (recovered.resetSources || recovered.droppedExtractJobs || recovered.reclaimedEmbedJobs) {
        logger.info('[KnowledgeIngestJobs] recovered stale state', {
          lane,
          reason: options?.reason ?? 'unspecified',
          ...recovered
        })
      }
    } catch (e) {
      logger.warn('[KnowledgeIngestJobs] recover stale state failed', {
        lane,
        error: e instanceof Error ? e.message : String(e)
      })
    }

    const { resolveActiveVaultId } = await import('../ipc/vault.ipc')
    const vaultId = resolveActiveVaultId()?.trim() || ''
    const pending = await repo.countIngestJobs({
      ...(vaultId ? { vaultId } : {}),
      stages,
      claimableOnly: true
    })
    if (pending === 0) {
      return { processed: 0, failed: 0, skipped: 'empty' }
    }

    const limit = options?.limit ?? 10
    const jobs = await repo.claimIngestJobs(limit, {
      ...(vaultId ? { vaultId } : {}),
      stages
    })
    jobs.sort((a, b) => {
      const rank = { extract: 0, embed: 1, graph: 2 }
      return (rank[a.stage] ?? 9) - (rank[b.stage] ?? 9)
    })
    for (const job of jobs) {
      if (job.stage === 'extract') markExtractJobLive(job.sourceId)
      if (job.stage === 'embed') markEmbedJobLive(job.sourceId)
      if (job.stage === 'graph') markGraphJobLive(job.sourceId)
    }
    if (jobs.some((job) => job.stage === 'graph')) {
      broadcastKnowledgeGraphProgress()
    }
    logger.info('[KnowledgeIngestJobs] consuming', {
      lane,
      reason: options?.reason ?? 'unspecified',
      claimed: jobs.length,
      pendingBefore: pending
    })

    let processed = 0
    let failed = 0

    try {
      for (const job of jobs) {
        try {
          if (job.stage === 'extract') {
            await svc.processExtractJob(job.sourceId)
          } else if (job.stage === 'graph') {
            await svc.processGraphJob(job.sourceId)
            broadcastKnowledgeGraphProgress()
          } else {
            await svc.processEmbedJob(job.sourceId)
          }
          await repo.completeIngestJob(job.id)
          processed++
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e)
          if (message.includes('knowledge-extract-cancelled')) {
            await repo.completeIngestJob(job.id)
            processed++
            continue
          }
          if (message === 'embedding-not-configured' || message === 'graph-extract-not-configured') {
            await repo.failIngestJob(job.id, message, { backoffMs: 5 * 60_000 })
            failed++
            continue
          }
          // needs_ocr 不算失败：extract 已写状态，删 job
          if (message.includes('needs_ocr')) {
            await repo.completeIngestJob(job.id)
            processed++
            continue
          }
          await repo.failIngestJob(job.id, message, {
            backoffMs: Math.min(30 * 60_000, 15_000 * Math.max(1, job.attempts))
          })
          failed++
        }
      }
    } finally {
      for (const job of jobs) {
        if (job.stage === 'extract') unmarkExtractJobLive(job.sourceId)
        if (job.stage === 'embed') unmarkEmbedJobLive(job.sourceId)
        if (job.stage === 'graph') unmarkGraphJobLive(job.sourceId)
      }
      if (jobs.some((job) => job.stage === 'graph')) {
        broadcastKnowledgeGraphProgress()
      }
    }

    return { processed, failed }
  })().finally(() => {
    laneInFlight[lane] = null
  })

  laneInFlight[lane] = run
  const result = await run
  try {
    if (knowledgeConnectionManager.isConnected()) {
      const repo = new KnowledgeRepository(knowledgeConnectionManager.getDb())
      const { resolveActiveVaultId } = await import('../ipc/vault.ipc')
      const activeVaultId = resolveActiveVaultId()?.trim() || ''
      const remaining = await repo.countIngestJobs({
        ...(activeVaultId ? { vaultId: activeVaultId } : {}),
        stages,
        claimableOnly: true
      })
      if (remaining > 0) {
        setTimeout(() => {
          void consumeKnowledgeLane(lane, { reason: 'drain' }).catch((e) => {
            logger.warn('[KnowledgeIngestJobs] drain failed', {
              lane,
              error: e instanceof Error ? e.message : String(e)
            })
          })
        }, 0)
      }
    }
  } catch {
    /* ignore */
  }
  return result
}

export function scheduleConsumeKnowledgeIngestJobs(reason: string): void {
  const kick = (lane: IngestLane) => {
    void consumeKnowledgeLane(lane, { reason }).catch((e) => {
      logger.warn('[KnowledgeIngestJobs] consume failed', {
        lane,
        reason,
        error: e instanceof Error ? e.message : String(e)
      })
    })
  }
  kick('index')
  kick('graph')
}
