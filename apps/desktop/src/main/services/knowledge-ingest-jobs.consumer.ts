import { logger } from '@baishou/shared'
import { KnowledgeRepository, knowledgeConnectionManager } from '@baishou/database-desktop'
import { KnowledgeEmbeddingStorage } from '@baishou/ai'
import { KnowledgeIngestService } from '@baishou/core-desktop'
import { getNotebookRawManager } from './raw-data-source.runtime'
import { fileSystem } from './node-file-system'

let consumeInFlight: Promise<{ processed: number; failed: number; skipped?: string }> | null =
  null

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
    deleteChunksBySource: (id) => repo.deleteChunksBySource(id)
  })
}

/**
 * 消费知识库摄入欠账（extract / embed），单飞 + 退避。
 */
export async function consumeKnowledgeIngestJobs(options?: {
  limit?: number
  reason?: string
}): Promise<{ processed: number; failed: number; skipped?: string }> {
  if (consumeInFlight) return consumeInFlight

  consumeInFlight = (async () => {
    if (!knowledgeConnectionManager.isConnected()) {
      return { processed: 0, failed: 0, skipped: 'db-not-connected' }
    }

    const repo = new KnowledgeRepository(knowledgeConnectionManager.getDb())
    const pending = await repo.countIngestJobs()
    if (pending === 0) {
      return { processed: 0, failed: 0, skipped: 'empty' }
    }

    const svc = await buildServiceWithEmbedding()
    if (!svc) {
      return { processed: 0, failed: 0, skipped: 'service-unavailable' }
    }

    const limit = options?.limit ?? 10
    const jobs = await repo.claimIngestJobs(limit)
    logger.info('[KnowledgeIngestJobs] consuming', {
      reason: options?.reason ?? 'unspecified',
      claimed: jobs.length,
      pendingBefore: pending
    })

    let processed = 0
    let failed = 0

    for (const job of jobs) {
      try {
        if (job.stage === 'extract') {
          await svc.processExtractJob(job.sourceId)
        } else {
          await svc.processEmbedJob(job.sourceId)
        }
        await repo.completeIngestJob(job.id)
        processed++
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        if (message === 'embedding-not-configured') {
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

    return { processed, failed }
  })().finally(() => {
    consumeInFlight = null
  })

  return consumeInFlight
}

export function scheduleConsumeKnowledgeIngestJobs(reason: string): void {
  void consumeKnowledgeIngestJobs({ reason }).catch((e) => {
    logger.warn('[KnowledgeIngestJobs] consume failed', {
      reason,
      error: e instanceof Error ? e.message : String(e)
    })
  })
}
