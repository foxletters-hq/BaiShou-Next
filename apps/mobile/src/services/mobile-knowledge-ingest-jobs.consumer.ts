import { logger, deriveLegacyVaultId } from '@baishou/shared'
import { expoKnowledgeConnectionManager, KnowledgeRepository } from '@baishou/database/expo'
import { KnowledgeEmbeddingStorage } from '@baishou/ai'
import { KnowledgeIngestService } from '@baishou/core-mobile'
import { createMobileFileSystem } from './create-mobile-file-system'
import { MobileStoragePathService } from './path.service'
import {
  ensureMobileRawDataRuntime,
  getMobileNotebookRawManager,
  resolveMobileEmbeddingForHydration
} from './mobile-raw-data-source.runtime'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'

let consumeInFlight: Promise<{ processed: number; failed: number; skipped?: string }> | null = null

async function buildMobileKnowledgeIngestService(): Promise<KnowledgeIngestService | null> {
  if (!expoKnowledgeConnectionManager.isConnected()) return null

  const runtime = agentDbRuntimeRef.current
  if (!runtime?.settingsManager || !runtime.pathService) return null

  const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
  if (!emb.embeddingProvider || !emb.embeddingModelId) return null

  const fileSystem = createMobileFileSystem()
  const pathService =
    (runtime.pathService as MobileStoragePathService) || new MobileStoragePathService(fileSystem)
  ensureMobileRawDataRuntime({ pathService, fileSystem })
  const notebookManager = getMobileNotebookRawManager()
  if (!notebookManager) return null

  const repo = new KnowledgeRepository(expoKnowledgeConnectionManager.getDb())
  const storage = new KnowledgeEmbeddingStorage(() => repo)
  const embeddingProvider = emb.embeddingProvider
  const embeddingModelId = emb.embeddingModelId
  const vaultId =
    (await runtime.pathService.getLocalActiveVaultId()) ||
    deriveLegacyVaultId(
      (await runtime.pathService.getActiveVaultNameForContext().catch(() => 'Personal')) ||
        'Personal'
    )

  return new KnowledgeIngestService({
    repo,
    notebookManager,
    fs: fileSystem,
    getVaultId: () => vaultId,
    embedding: {
      isConfigured: true,
      getModelId: () => embeddingModelId,
      getProviderInstance: async () => embeddingProvider
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
 * 消费知识库 embed 欠账（移动端消费端：只跑 embed，一般不跑 extract）。
 */
export async function consumeMobileKnowledgeIngestJobs(options?: {
  limit?: number
  reason?: string
}): Promise<{ processed: number; failed: number; skipped?: string }> {
  if (consumeInFlight) return consumeInFlight

  consumeInFlight = (async () => {
    if (!expoKnowledgeConnectionManager.isConnected()) {
      return { processed: 0, failed: 0, skipped: 'db-not-connected' }
    }

    const repo = new KnowledgeRepository(expoKnowledgeConnectionManager.getDb())
    const pending = await repo.countIngestJobs()
    if (pending === 0) {
      return { processed: 0, failed: 0, skipped: 'empty' }
    }

    const svc = await buildMobileKnowledgeIngestService()
    if (!svc) {
      return { processed: 0, failed: 0, skipped: 'embedding-not-configured' }
    }

    const limit = options?.limit ?? 8
    const jobs = await repo.claimIngestJobs(limit)
    logger.info('[MobileKnowledgeIngestJobs] consuming', {
      reason: options?.reason ?? 'unspecified',
      claimed: jobs.length,
      pendingBefore: pending
    })

    let processed = 0
    let failed = 0

    for (const job of jobs) {
      try {
        // 移动端是消费端：优先 embed；若误排了 extract 则跳过并标失败提示
        if (job.stage === 'extract') {
          // K1.5：text/url/note/md 可在移动端 extract；PDF 跳过（无 OCR）
          const source = await repo.getSource(job.sourceId)
          const rel = source?.relativePath || ''
          const isPdf = /\.pdf$/i.test(rel) || /\.pdf$/i.test(source?.title || '')
          if (isPdf) {
            await repo.failIngestJob(job.id, 'mobile-skip-pdf-extract', {
              backoffMs: 24 * 60 * 60_000
            })
            failed++
            continue
          }
          await svc.processExtractJob(job.sourceId)
          await repo.completeIngestJob(job.id)
          processed++
          continue
        }
        await svc.processEmbedJob(job.sourceId)
        await repo.completeIngestJob(job.id)
        processed++
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        if (message === 'embedding-not-configured') {
          await repo.failIngestJob(job.id, message, { backoffMs: 5 * 60_000 })
          failed++
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

export function scheduleConsumeMobileKnowledgeIngestJobs(reason: string): void {
  void consumeMobileKnowledgeIngestJobs({ reason }).catch((e) => {
    logger.warn('[MobileKnowledgeIngestJobs] schedule failed:', e as Error)
  })
}
