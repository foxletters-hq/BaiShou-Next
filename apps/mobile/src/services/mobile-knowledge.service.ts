import { logger, deriveLegacyVaultId } from '@baishou/shared'
import {
  expoKnowledgeConnectionManager,
  KnowledgeRepository,
  type ExpoSqliteDatabase
} from '@baishou/database/expo'
import {
  KnowledgeAskService,
  KnowledgeSearchService,
  type KnowledgeSqlExecutor
} from '@baishou/core-mobile'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import {
  ensureMobileRawDataRuntime,
  getMobileNotebookRawManager,
  resolveMobileEmbeddingForHydration
} from './mobile-raw-data-source.runtime'
import { createMobileFileSystem } from './create-mobile-file-system'
import { buildMobileSummaryAiClient } from './mobile-summary-ai-client'
import type { GlobalModelsConfig } from '@baishou/shared'

function requireRepo(): KnowledgeRepository {
  if (!expoKnowledgeConnectionManager.isConnected()) {
    throw new Error('knowledge db not connected')
  }
  return new KnowledgeRepository(expoKnowledgeConnectionManager.getDb())
}

async function resolveMobileActiveVaultId(): Promise<string> {
  const runtime = agentDbRuntimeRef.current
  if (runtime?.pathService) {
    try {
      const stored = await runtime.pathService.getLocalActiveVaultId()
      if (stored?.trim()) return stored.trim()
      const name = await runtime.pathService.getActiveVaultNameForContext()
      if (name?.trim()) return deriveLegacyVaultId(name.trim())
    } catch {
      /* fall through */
    }
  }
  return deriveLegacyVaultId('Personal')
}

function createKnowledgeSqlExecutor(expoDb: ExpoSqliteDatabase): KnowledgeSqlExecutor {
  const db = expoDb as ExpoSqliteDatabase & {
    getAllSync?: (sql: string, params?: unknown[]) => unknown[]
  }
  return {
    all(sql, params = []) {
      if (typeof db.getAllSync !== 'function') {
        throw new Error('expo-sqlite getAllSync unavailable for knowledge search')
      }
      return db.getAllSync(sql, params) as Array<Record<string, unknown>>
    }
  }
}

export async function mobileListNotebooks() {
  return requireRepo().listNotebooks({ vaultId: await resolveMobileActiveVaultId() })
}

export async function mobileListSources(notebookId: string) {
  return requireRepo().listSources(notebookId)
}

export async function mobileGetKnowledgeStats(notebookId?: string) {
  return requireRepo().getStats(notebookId, await resolveMobileActiveVaultId())
}

export async function mobileHasKnowledgeModelMismatch(): Promise<boolean> {
  const runtime = agentDbRuntimeRef.current
  if (!runtime?.settingsManager) return false
  const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
  if (!emb.embeddingModelId) return false
  const count = await requireRepo().countHeterogeneousEmbeddings(emb.embeddingModelId, {
    vaultId: await resolveMobileActiveVaultId()
  })
  return count > 0
}

export async function mobileRebuildKnowledgeIndex(notebookId: string): Promise<void> {
  const repo = requireRepo()
  const vaultId = await resolveMobileActiveVaultId()
  const sources = await repo.listSources(notebookId)
  await repo.deleteChunksByNotebook(notebookId)
  for (const source of sources) {
    if (!source.extractedTextHash && source.status === 'needs_ocr') continue
    await repo.updateSourceStatus(source.id, 'pending', { errorMessage: null })
    await repo.enqueueIngestJob({
      notebookId,
      sourceId: source.id,
      stage: 'embed',
      vaultId: source.vaultId?.trim() || vaultId
    })
  }
  const { scheduleConsumeMobileKnowledgeIngestJobs } = await import(
    './mobile-knowledge-ingest-jobs.consumer'
  )
  scheduleConsumeMobileKnowledgeIngestJobs('mobile-rebuild')
}

export async function mobileAskKnowledge(input: {
  notebookId: string
  question: string
  topK?: number
}): Promise<{
  answer: string
  citations: Array<{
    sourceId: string
    title: string
    chunkId: string
    chunkIndex: number
    excerpt: string
    offset?: number
    len?: number
    page?: number
    score: number
    source: string
  }>
}> {
  const mismatch = await mobileHasKnowledgeModelMismatch()
  if (mismatch) {
    throw new Error('knowledge-model-mismatch')
  }

  const runtime = agentDbRuntimeRef.current
  if (!runtime?.settingsManager || !runtime.pathService) {
    throw new Error('runtime not ready')
  }

  const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
  if (!emb.embeddingProvider || !emb.embeddingModelId) {
    throw new Error('embedding-not-configured')
  }

  const fileSystem = createMobileFileSystem()
  ensureMobileRawDataRuntime({
    pathService: runtime.pathService,
    fileSystem
  })
  const notebookManager = getMobileNotebookRawManager()
  if (!notebookManager) throw new Error('notebook manager unavailable')

  const repo = requireRepo()
  const expoDb = expoKnowledgeConnectionManager.getExpoDb()
  const search = new KnowledgeSearchService({
    sql: createKnowledgeSqlExecutor(expoDb),
    getSourceTitle: async (sourceId) => {
      const row = await repo.getSource(sourceId)
      return row?.title ?? null
    }
  })

  const embeddingProvider = emb.embeddingProvider
  const embeddingModelId = emb.embeddingModelId
  const summaryClient = buildMobileSummaryAiClient(runtime.settingsManager)

  const ask = new KnowledgeAskService({
    search,
    embedQuery: async (q) => {
      const { embed } = await import('ai')
      const model = embeddingProvider.getEmbeddingModel(embeddingModelId) as never
      const { embedding } = await embed({ model, value: q })
      return Array.from(embedding)
    },
    getSourceTitle: async (sourceId) => {
      const row = await repo.getSource(sourceId)
      return row?.title ?? null
    },
    getPageBoundaries: async (notebookId, sourceId) => {
      const pages = await notebookManager.readPagesJson(notebookId, sourceId)
      return pages?.pages ?? null
    },
    generateAnswer: async ({ question, contextBlocks }) => {
      const globalModels = await runtime.settingsManager.get<GlobalModelsConfig>('global_models')
      const modelId = globalModels?.globalDialogueModelId || globalModels?.globalSummaryModelId
      if (!modelId) throw new Error('No chat/summary model configured')
      const { system, prompt } = KnowledgeAskService.buildPrompt(question, contextBlocks)
      return summaryClient.generateContent(prompt, modelId, { system })
    }
  })

  try {
    const result = await ask.ask(input)
    return {
      answer: result.answer,
      citations: result.citations.map((c) => ({
        ...c,
        source: String(c.source)
      }))
    }
  } catch (e) {
    logger.warn('[MobileKnowledge] ask failed:', e as Error)
    throw e
  }
}

async function buildMobileIngestService() {
  const runtime = agentDbRuntimeRef.current
  if (!runtime?.settingsManager || !runtime.pathService) {
    throw new Error('runtime not ready')
  }
  if (!expoKnowledgeConnectionManager.isConnected()) {
    throw new Error('knowledge db not connected')
  }

  const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
  const fileSystem = createMobileFileSystem()
  ensureMobileRawDataRuntime({
    pathService: runtime.pathService,
    fileSystem
  })
  const notebookManager = getMobileNotebookRawManager()
  if (!notebookManager) throw new Error('notebook manager unavailable')

  const repo = requireRepo()
  const { KnowledgeEmbeddingStorage } = await import('@baishou/ai')
  const { KnowledgeIngestService } = await import('@baishou/core-mobile')
  const storage = new KnowledgeEmbeddingStorage(() => repo)
  const vaultId = await resolveMobileActiveVaultId()

  return new KnowledgeIngestService({
    repo,
    notebookManager,
    fs: fileSystem,
    getVaultId: () => vaultId,
    embedding:
      emb.embeddingProvider && emb.embeddingModelId
        ? {
            isConfigured: true,
            getModelId: () => emb.embeddingModelId!,
            getProviderInstance: async () => emb.embeddingProvider!
          }
        : undefined,
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

/** K1.5：移动端粘贴文本 / URL 入库 */
export async function mobileImportSource(input: {
  notebookId: string
  title: string
  kind: 'text' | 'url'
  textContent?: string
  originUrl?: string
}): Promise<{ sourceId: string }> {
  const { fetchUrlAsMarkdown } = await import('@baishou/ai')
  let payload = { ...input }

  if (input.kind === 'url') {
    const originUrl = (input.originUrl || input.textContent || '').trim()
    if (!originUrl) throw new Error('import url requires originUrl')
    const fetched = await fetchUrlAsMarkdown(originUrl)
    if (!fetched.markdown?.trim()) throw new Error('URL 内容为空或无法解析')
    payload = {
      ...input,
      kind: 'url',
      originUrl: fetched.finalUrl || originUrl,
      title: input.title?.trim() || fetched.title || originUrl,
      textContent: fetched.markdown
    }
  }

  const svc = await buildMobileIngestService()
  const result = await svc.importSource({
    notebookId: payload.notebookId,
    title: payload.title,
    kind: payload.kind,
    textContent: payload.textContent,
    originUrl: payload.originUrl
  })

  const { scheduleConsumeMobileKnowledgeIngestJobs } = await import(
    './mobile-knowledge-ingest-jobs.consumer'
  )
  scheduleConsumeMobileKnowledgeIngestJobs('after-mobile-import')
  return result
}

export async function mobileSaveAskAsNote(input: {
  notebookId: string
  question: string
  answer: string
  citations?: Array<{ title: string; page?: number; excerpt?: string }>
}): Promise<{ sourceId: string }> {
  const svc = await buildMobileIngestService()
  const result = await svc.saveAskAsNote(input)
  const { scheduleConsumeMobileKnowledgeIngestJobs } = await import(
    './mobile-knowledge-ingest-jobs.consumer'
  )
  scheduleConsumeMobileKnowledgeIngestJobs('after-mobile-save-note')
  return result
}

/** 供 Agent knowledge_search 工具注入 */
export async function mobileSearchKnowledge(opts: {
  query: string
  notebookId: string
  limit?: number
}): Promise<
  Array<{
    chunkId: string
    sourceId: string
    notebookId: string
    chunkIndex: number
    chunkText: string
    score: number
    title?: string
    offset?: number
    len?: number
  }>
> {
  const runtime = agentDbRuntimeRef.current
  if (!runtime?.settingsManager) throw new Error('runtime not ready')
  if (!expoKnowledgeConnectionManager.isConnected()) {
    throw new Error('knowledge db not connected')
  }
  const mismatch = await mobileHasKnowledgeModelMismatch()
  if (mismatch) {
    throw new Error('knowledge-model-mismatch')
  }
  const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
  if (!emb.embeddingProvider || !emb.embeddingModelId) {
    throw new Error('embedding-not-configured')
  }
  const repo = requireRepo()
  const expoDb = expoKnowledgeConnectionManager.getExpoDb()
  const search = new KnowledgeSearchService({
    sql: createKnowledgeSqlExecutor(expoDb),
    getSourceTitle: async (sourceId) => {
      const row = await repo.getSource(sourceId)
      return row?.title ?? null
    }
  })
  const { embed } = await import('ai')
  const model = emb.embeddingProvider.getEmbeddingModel(emb.embeddingModelId) as never
  const { embedding } = await embed({ model, value: opts.query })
  const hits = await search.search({
    notebookId: opts.notebookId,
    query: opts.query,
    queryVector: Array.from(embedding),
    topK: opts.limit
  })
  return hits.map((h) => ({
    chunkId: h.chunkId,
    sourceId: h.sourceId,
    notebookId: h.notebookId,
    chunkIndex: h.chunkIndex,
    chunkText: h.chunkText,
    score: h.score,
    title: h.title,
    offset: h.offset,
    len: h.len
  }))
}
