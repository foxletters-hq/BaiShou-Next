import { EmbeddingAdapter } from '@baishou/ai'
import { backfillUnembeddedGraphNodes, MemorySyncService } from '@baishou/core-mobile'
import { GraphRepository } from '@baishou/database'
import { logger, probeEmbeddingApi } from '@baishou/shared'
import { assertMobileRagCanContinue } from './mobile-rag-operation-control'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import { consumeMobileKnowledgeIngestJobs } from './mobile-knowledge-ingest-jobs.consumer'
import { invalidateMobilePendingEmbedCountsCache } from './mobile-pending-embed-counts'
import type { MobileRagServiceDeps } from './mobile-rag-core.helpers'
import { resolveVaultScope } from './mobile-rag-core.helpers'
import {
  createMobileMemoryEmbedSink,
  getMobileMemoryRawManager
} from './mobile-raw-data-source.runtime'

export async function runMobileManualPendingEmbedFill(deps: MobileRagServiceDeps): Promise<void> {
  const vaultScope = await resolveVaultScope(deps)
  const vaultId = await vaultScope.resolveActiveVaultId()
  if (!vaultId) return

  const adapter = await resolveMobileFillAdapter(deps)
  if (!adapter?.isConfigured) return

  const probe = await probeEmbeddingApi((text) => adapter.embedQuery(text))
  if (!probe.ok) {
    throw new Error(probe.message)
  }

  await assertMobileRagCanContinue()

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
    logger.warn('[PendingEmbedFill] mobile memory fill failed', error as Error)
  }

  await assertMobileRagCanContinue()

  try {
    const drizzleDb = agentDbRuntimeRef.current?.drizzleDb
    if (drizzleDb) {
      const graphRepo = new GraphRepository(drizzleDb)
      await backfillUnembeddedGraphNodes({
        vaultId,
        listUnembeddedLiveNodes: (id) => graphRepo.listUnembeddedLiveNodes(id),
        updateNodeEmbedding: (id, vid, embedding, modelId) =>
          graphRepo.updateNodeEmbedding(id, vid, embedding, modelId),
        embedQuery: (text) => adapter.embedQuery(text),
        modelId: adapter.embeddingModelId ?? ''
      })
    }
  } catch (error) {
    logger.warn('[PendingEmbedFill] mobile graph node fill failed', error as Error)
  }

  await assertMobileRagCanContinue()

  try {
    const { expoKnowledgeConnectionManager, KnowledgeRepository } =
      await import('@baishou/database/expo')
    if (expoKnowledgeConnectionManager.isConnected()) {
      const repo = new KnowledgeRepository(expoKnowledgeConnectionManager.getDb())
      const pending = await repo.listPendingEmbedSources(vaultId, {
        modelId: adapter.embeddingModelId
      })
      for (const source of pending) {
        await repo.enqueueIngestJob({
          notebookId: source.notebookId,
          sourceId: source.id,
          stage: 'embed',
          vaultId: source.vaultId || vaultId
        })
      }
      if (pending.length > 0) {
        for (let i = 0; i < 20; i += 1) {
          const result = await consumeMobileKnowledgeIngestJobs({
            reason: 'manual-pending-fill',
            limit: 10
          })
          if (!result.processed) break
        }
      }
    }
  } catch (error) {
    logger.warn('[PendingEmbedFill] mobile knowledge fill failed', error as Error)
  }

  invalidateMobilePendingEmbedCountsCache()
}

async function resolveMobileFillAdapter(
  deps: MobileRagServiceDeps
): Promise<EmbeddingAdapter | null> {
  const { resolveMobileEmbeddingForHydration } = await import('./mobile-raw-data-source.runtime')
  const emb = await resolveMobileEmbeddingForHydration(deps.settingsManager)
  if (!emb.embeddingProvider || !emb.embeddingModelId) return null
  return new EmbeddingAdapter(emb.embeddingProvider, emb.embeddingModelId, deps.hsRepo)
}
