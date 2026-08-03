import { ipcMain } from 'electron'
import path from 'path'
import { KnowledgeRepository, knowledgeConnectionManager } from '@baishou/database-desktop'
import {
  KnowledgeAskService,
  KnowledgeIngestService,
  KnowledgeSearchService
} from '@baishou/core-desktop'
import { KnowledgeEmbeddingStorage, fetchUrlAsMarkdown } from '@baishou/ai'
import { logger } from '@baishou/shared'
import { getNotebookRawManager } from '../services/raw-data-source.runtime'
import { fileSystem } from '../services/node-file-system'
import { scheduleConsumeKnowledgeIngestJobs } from '../services/knowledge-ingest-jobs.consumer'
import { getEmbeddingService } from './rag.ipc'
import { buildSummaryAiClient } from './summary-ai-client'
import { settingsManager } from './settings.ipc'
import type { GlobalModelsConfig } from '@baishou/shared'

function requireKnowledgeRepo(): KnowledgeRepository {
  if (!knowledgeConnectionManager.isConnected()) {
    throw new Error('knowledge db not connected')
  }
  return new KnowledgeRepository(knowledgeConnectionManager.getDb())
}

function buildIngestService(): KnowledgeIngestService {
  const repo = requireKnowledgeRepo()
  const notebookManager = getNotebookRawManager()
  const storage = new KnowledgeEmbeddingStorage(() => repo)

  return new KnowledgeIngestService({
    repo,
    notebookManager,
    fs: fileSystem,
    insertChunk: async (params) => {
      await storage.insertEmbedding({
        id: params.chunkId,
        sourceType: 'knowledge',
        sourceId: params.sourceId,
        groupId: params.notebookId,
        vaultId: 'knowledge',
        chunkIndex: params.chunkIndex,
        chunkText: params.chunkText,
        metadataJson: params.metadataJson,
        embedding: params.embedding,
        modelId: params.modelId
      })
    },
    deleteChunksBySource: (sourceId) => repo.deleteChunksBySource(sourceId)
  })
}

let ingestService: KnowledgeIngestService | null = null

export function getKnowledgeIngestService(): KnowledgeIngestService {
  if (!ingestService) {
    ingestService = buildIngestService()
  }
  return ingestService
}

export function resetKnowledgeIngestService(): void {
  ingestService = null
}

function buildSearchService(): KnowledgeSearchService {
  const repo = requireKnowledgeRepo()
  const sqlite = knowledgeConnectionManager.getSqlite()
  return new KnowledgeSearchService({
    sql: {
      all: (sql, params = []) =>
        sqlite.prepare(sql).all(...params) as Array<Record<string, unknown>>
    },
    getSourceTitle: async (sourceId) => {
      const row = await repo.getSource(sourceId)
      return row?.title ?? null
    }
  })
}

function buildAskService(): KnowledgeAskService {
  const repo = requireKnowledgeRepo()
  const notebookManager = getNotebookRawManager()
  const search = buildSearchService()
  const embeddingService = getEmbeddingService()
  const summaryClient = buildSummaryAiClient()

  return new KnowledgeAskService({
    search,
    embedQuery: (q) => embeddingService.embedQuery(q),
    getSourceTitle: async (sourceId) => {
      const row = await repo.getSource(sourceId)
      return row?.title ?? null
    },
    getPageBoundaries: async (notebookId, sourceId) => {
      const pages = await notebookManager.readPagesJson(notebookId, sourceId)
      return pages?.pages ?? null
    },
    generateAnswer: async ({ question, contextBlocks }) => {
      const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
      const modelId = globalModels?.globalChatModelId || globalModels?.globalSummaryModelId
      if (!modelId) throw new Error('No chat/summary model configured')
      const { system, prompt } = KnowledgeAskService.buildPrompt(question, contextBlocks)
      return summaryClient.generateContent(prompt, modelId, { system })
    }
  })
}

export function registerKnowledgeIPC(): void {
  ipcMain.handle(
    'knowledge:create-notebook',
    async (_e, input: { name: string; description?: string }) => {
      const svc = getKnowledgeIngestService()
      return svc.createNotebook(input)
    }
  )

  ipcMain.handle('knowledge:list-notebooks', async () => {
    const svc = getKnowledgeIngestService()
    return svc.listNotebooks()
  })

  ipcMain.handle(
    'knowledge:import-source',
    async (
      _e,
      input: {
        notebookId: string
        title: string
        kind: 'file' | 'text' | 'url'
        absolutePath?: string
        textContent?: string
        fileName?: string
        originUrl?: string
      }
    ) => {
      const svc = getKnowledgeIngestService()
      let payload = { ...input }

      if (input.kind === 'url') {
        const originUrl = (input.originUrl || input.textContent || '').trim()
        if (!originUrl) throw new Error('import url requires originUrl')
        const fetched = await fetchUrlAsMarkdown(originUrl)
        if (!fetched.markdown?.trim()) {
          throw new Error('URL 内容为空或无法解析')
        }
        payload = {
          ...input,
          kind: 'url',
          originUrl: fetched.finalUrl || originUrl,
          title: input.title?.trim() || fetched.title || originUrl,
          textContent: fetched.markdown,
          fileName: `${(input.title || fetched.title || 'page').slice(0, 40)}.md`
        }
      }

      const result = await svc.importSource({
        ...payload,
        fileName:
          payload.fileName ||
          (payload.absolutePath ? path.basename(payload.absolutePath) : payload.title)
      })
      scheduleConsumeKnowledgeIngestJobs('after-import')
      return result
    }
  )

  ipcMain.handle('knowledge:retry-source', async (_e, sourceId: string) => {
    const svc = getKnowledgeIngestService()
    await svc.retrySource(sourceId)
    scheduleConsumeKnowledgeIngestJobs('after-retry')
    return { ok: true }
  })

  ipcMain.handle('knowledge:rebuild-index', async (_e, notebookId: string) => {
    const svc = getKnowledgeIngestService()
    await svc.rebuildIndex(notebookId)
    scheduleConsumeKnowledgeIngestJobs('after-rebuild')
    return { ok: true }
  })

  ipcMain.handle('knowledge:get-stats', async (_e, notebookId?: string) => {
    const repo = requireKnowledgeRepo()
    return repo.getStats(notebookId)
  })

  ipcMain.handle('knowledge:has-model-mismatch', async () => {
    const repo = requireKnowledgeRepo()
    const embeddingService = getEmbeddingService()
    const { getEmbeddingConfig } = await import('./rag.ipc')
    const embeddingConfig = getEmbeddingConfig()
    await embeddingConfig.load()
    const modelId = embeddingConfig.getGlobalEmbeddingModelId()
    if (!modelId || !embeddingService.isConfigured) return false
    const count = await repo.countHeterogeneousEmbeddings(modelId)
    return count > 0
  })

  ipcMain.handle('knowledge:list-sources', async (_e, notebookId: string) => {
    const repo = requireKnowledgeRepo()
    return repo.listSources(notebookId)
  })

  ipcMain.handle(
    'knowledge:search',
    async (
      _e,
      input: { notebookId: string; query: string; topK?: number }
    ) => {
      const embeddingService = getEmbeddingService()
      const queryVector = await embeddingService.embedQuery(input.query)
      if (!queryVector?.length) {
        throw new Error('embedding-not-configured')
      }
      const search = buildSearchService()
      return search.search({
        notebookId: input.notebookId,
        query: input.query,
        queryVector,
        topK: input.topK
      })
    }
  )

  ipcMain.handle(
    'knowledge:ask',
    async (_e, input: { notebookId: string; question: string; topK?: number }) => {
      const repo = requireKnowledgeRepo()
      const embeddingService = getEmbeddingService()
      const { getEmbeddingConfig } = await import('./rag.ipc')
      const embeddingConfig = getEmbeddingConfig()
      await embeddingConfig.load()
      const modelId = embeddingConfig.getGlobalEmbeddingModelId()
      if (modelId && embeddingService.isConfigured) {
        const mismatch = await repo.countHeterogeneousEmbeddings(modelId)
        if (mismatch > 0) {
          throw new Error('knowledge-model-mismatch')
        }
      }
      const ask = buildAskService()
      return ask.ask(input)
    }
  )

  ipcMain.handle(
    'knowledge:get-extracted-preview',
    async (_e, input: { notebookId: string; sourceId: string; maxChars?: number }) => {
      const notebookManager = getNotebookRawManager()
      const text = await notebookManager.readExtractedText(input.notebookId, input.sourceId)
      if (text == null) return { text: null as string | null, truncated: false }
      const max = Math.max(200, input.maxChars ?? 4000)
      if (text.length <= max) return { text, truncated: false }
      return { text: text.slice(0, max), truncated: true }
    }
  )

  logger.info('[KnowledgeIPC] handlers registered')
}
