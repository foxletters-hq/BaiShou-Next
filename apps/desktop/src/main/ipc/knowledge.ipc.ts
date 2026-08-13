import { ipcMain, BrowserWindow } from 'electron'
import path from 'path'
import { KnowledgeRepository, knowledgeConnectionManager } from '@baishou/database-desktop'
import {
  KnowledgeAskService,
  KnowledgeChatService,
  KnowledgeIngestService,
  KnowledgeSearchService,
  probeExtractEngineCapabilities,
  type ExtractEngineId,
  type KnowledgeExtractProgress
} from '@baishou/core-desktop'
import { KnowledgeEmbeddingStorage, fetchUrlAsMarkdown } from '@baishou/ai'
import {
  isVisionModel,
  logger,
  type GlobalModelsConfig,
  type KnowledgeConfig,
  type AIProviderConfig
} from '@baishou/shared'
import { getNotebookRawManager } from '../services/raw-data-source.runtime'
import { fileSystem } from '../services/node-file-system'
import { scheduleConsumeKnowledgeIngestJobs } from '../services/knowledge-ingest-jobs.consumer'
import { getEmbeddingService } from './rag.ipc'
import { buildSummaryAiClient } from './summary-ai-client'
import { settingsManager } from './settings.ipc'
import { resolveActiveVaultId } from './vault.ipc'

const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeConfig = {
  defaultExtractEngine: 'simple',
  ocrLanguage: 'chi_sim+eng',
  ocrDpi: 250,
  ocrConcurrency: 1,
  multiQueryAsk: false
}

function requireKnowledgeRepo(): KnowledgeRepository {
  if (!knowledgeConnectionManager.isConnected()) {
    throw new Error('knowledge db not connected')
  }
  return new KnowledgeRepository(knowledgeConnectionManager.getDb())
}

function requireActiveVaultId(): string {
  const id = resolveActiveVaultId()?.trim() || ''
  if (!id) throw new Error('active vault not ready')
  return id
}

async function assertKnowledgeModelMatch(repo: KnowledgeRepository): Promise<void> {
  const embeddingService = getEmbeddingService()
  const { getEmbeddingConfig } = await import('./rag.ipc')
  const embeddingConfig = getEmbeddingConfig()
  await embeddingConfig.load()
  const modelId = embeddingConfig.getGlobalEmbeddingModelId()
  if (!modelId || !embeddingService.isConfigured) return
  const vaultId = requireActiveVaultId()
  const mismatch = await repo.countHeterogeneousEmbeddings(modelId, { vaultId })
  if (mismatch > 0) {
    throw new Error('knowledge-model-mismatch')
  }
}

async function loadKnowledgeConfig(): Promise<KnowledgeConfig> {
  const raw = (await settingsManager.get<KnowledgeConfig>('knowledge_config')) || {}
  return { ...DEFAULT_KNOWLEDGE_CONFIG, ...raw }
}

async function resolveVisionConfigured(): Promise<{
  configured: boolean
  modelId: string | null
  providerId: string | null
}> {
  const cfg = await loadKnowledgeConfig()
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
  if (!modelId) return { configured: false, modelId: null, providerId: null }
  const ok = isVisionModel(modelId, provider?.type || provider?.id)
  return { configured: ok, modelId, providerId: provider?.id ?? providerId }
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

function buildIngestService(): KnowledgeIngestService {
  const repo = requireKnowledgeRepo()
  const notebookManager = getNotebookRawManager()
  const storage = new KnowledgeEmbeddingStorage(() => repo)

  return new KnowledgeIngestService({
    repo,
    notebookManager,
    fs: fileSystem,
    getVaultId: () => requireActiveVaultId(),
    onExtractProgress: broadcastKnowledgeOcrProgress,
    getExtractConfig: async () => {
      const cfg = await loadKnowledgeConfig()
      const vision = await resolveVisionConfigured()
      return {
        defaultEngine: cfg.defaultExtractEngine,
        ocrLanguage: cfg.ocrLanguage,
        ocrDpi: cfg.ocrDpi,
        ocrConcurrency: cfg.ocrConcurrency,
        visionModelConfigured: vision.configured,
        visionModelId: vision.modelId
      }
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
      const modelId = globalModels?.globalDialogueModelId || globalModels?.globalSummaryModelId
      if (!modelId) throw new Error('No chat/summary model configured')
      const { system, prompt } = KnowledgeAskService.buildPrompt(question, contextBlocks)
      return summaryClient.generateContent(prompt, modelId, { system })
    }
  })
}

function buildChatService(): KnowledgeChatService {
  const repo = requireKnowledgeRepo()
  const notebookManager = getNotebookRawManager()
  const summaryClient = buildSummaryAiClient()

  return new KnowledgeChatService({
    loadSourceTexts: async (notebookId, sourceIds) => {
      const out: Array<{ sourceId: string; title: string; text: string }> = []
      for (const id of sourceIds) {
        const row = await repo.getSource(id)
        if (!row || row.notebookId !== notebookId) continue
        const text = await notebookManager.readExtractedText(notebookId, id)
        if (!text?.trim()) continue
        out.push({ sourceId: id, title: row.title, text })
      }
      return out
    },
    generateAnswer: async ({ question, contextBlocks }) => {
      const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
      const modelId = globalModels?.globalDialogueModelId || globalModels?.globalSummaryModelId
      if (!modelId) throw new Error('No chat/summary model configured')
      const { system, prompt } = KnowledgeChatService.buildPrompt(question, contextBlocks)
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
        kind: 'file' | 'text' | 'url' | 'note'
        absolutePath?: string
        textContent?: string
        fileName?: string
        originUrl?: string
        extractEngine?: ExtractEngineId
      }
    ) => {
      const svc = getKnowledgeIngestService()
      const cfg = await loadKnowledgeConfig()
      let payload = { ...input }

      if (input.kind === 'url') {
        const originUrl = (input.originUrl || input.textContent || '').trim()
        if (!originUrl) throw new Error('import url requires originUrl')
        const fetched = await fetchUrlAsMarkdown(originUrl)
        if (!fetched.markdown?.trim()) {
          throw new Error('URL content empty or could not be parsed')
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
        extractEngine: input.extractEngine || cfg.defaultExtractEngine || 'simple',
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
    return repo.getStats(notebookId, requireActiveVaultId())
  })

  ipcMain.handle('knowledge:has-model-mismatch', async () => {
    const repo = requireKnowledgeRepo()
    const embeddingService = getEmbeddingService()
    const { getEmbeddingConfig } = await import('./rag.ipc')
    const embeddingConfig = getEmbeddingConfig()
    await embeddingConfig.load()
    const modelId = embeddingConfig.getGlobalEmbeddingModelId()
    if (!modelId || !embeddingService.isConfigured) return false
    const vaultId = requireActiveVaultId()
    const count = await repo.countHeterogeneousEmbeddings(modelId, { vaultId })
    return count > 0
  })

  ipcMain.handle('knowledge:list-sources', async (_e, notebookId: string) => {
    const repo = requireKnowledgeRepo()
    return repo.listSources(notebookId)
  })

  ipcMain.handle(
    'knowledge:search',
    async (_e, input: { notebookId: string; query: string; topK?: number }) => {
      const repo = requireKnowledgeRepo()
      await assertKnowledgeModelMatch(repo)
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
    async (
      _e,
      input: { notebookId: string; question: string; topK?: number; multiQuery?: boolean }
    ) => {
      const repo = requireKnowledgeRepo()
      await assertKnowledgeModelMatch(repo)
      const cfg = await loadKnowledgeConfig()
      const ask = buildAskService()
      return ask.ask({
        ...input,
        multiQuery: input.multiQuery ?? cfg.multiQueryAsk ?? false
      })
    }
  )

  ipcMain.handle(
    'knowledge:chat',
    async (
      _e,
      input: {
        notebookId: string
        question: string
        sourceIds: string[]
        maxContextChars?: number
      }
    ) => {
      const chat = buildChatService()
      const { clampKnowledgeChatContextChars } = await import('@baishou/core-desktop')
      return chat.chat({
        ...input,
        maxContextChars: clampKnowledgeChatContextChars(input.maxContextChars)
      })
    }
  )

  ipcMain.handle(
    'knowledge:save-note',
    async (
      _e,
      input: {
        notebookId: string
        title?: string
        question: string
        answer: string
        citations?: Array<{ title: string; page?: number; excerpt?: string }>
      }
    ) => {
      const svc = getKnowledgeIngestService()
      const result = await svc.saveAskAsNote(input)
      scheduleConsumeKnowledgeIngestJobs('after-save-note')
      return result
    }
  )

  ipcMain.handle(
    'knowledge:ocr-missing-pages',
    async (
      _e,
      input: {
        sourceId: string
        engine?: ExtractEngineId
        pageNumbers?: number[]
      }
    ) => {
      const svc = getKnowledgeIngestService()
      const result = await svc.ocrMissingPages(input.sourceId, {
        engine: input.engine,
        pageNumbers: input.pageNumbers
      })
      scheduleConsumeKnowledgeIngestJobs('after-ocr')
      return result
    }
  )

  ipcMain.handle('knowledge:cancel-extract', async (_e, sourceId: string) => {
    const svc = getKnowledgeIngestService()
    const result = await svc.cancelExtract(sourceId)
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      try {
        win.webContents.send('knowledge:ocr-progress', {
          sourceId,
          page: 0,
          total: 0,
          phase: 'ocr'
        })
      } catch {
        /* ignore */
      }
    }
    return result
  })

  ipcMain.handle('knowledge:recover-stale', async () => {
    const svc = getKnowledgeIngestService()
    const result = await svc.recoverStaleIngestState()
    scheduleConsumeKnowledgeIngestJobs('recover')
    return result
  })

  ipcMain.handle(
    'knowledge:get-source-file',
    async (_e, input: { sourceId: string }) => {
      const repo = requireKnowledgeRepo()
      const source = await repo.getSource(input.sourceId)
      if (!source) throw new Error(`source not found: ${input.sourceId}`)

      const notebookManager = getNotebookRawManager()
      const fileNameFromPath = source.relativePath
        ? path.basename(source.relativePath)
        : source.title
      const ext = path.extname(fileNameFromPath || '').toLowerCase()

      if (!source.relativePath) {
        return {
          kind: 'unsupported' as const,
          fileName: source.title,
          localUrl: null as string | null,
          textContent: null as string | null,
          originUrl: source.originUrl ?? null
        }
      }

      const abs = await notebookManager.absolutePath(source.relativePath)
      const localUrl = `local:///${abs.replace(/\\/g, '/')}`
      const isTextLike =
        source.sourceKind === 'text' ||
        source.sourceKind === 'note' ||
        source.sourceKind === 'url' ||
        ['.md', '.txt', '.markdown'].includes(ext)

      if (ext === '.pdf') {
        return {
          kind: 'pdf' as const,
          fileName: fileNameFromPath || source.title,
          localUrl,
          textContent: null as string | null,
          originUrl: source.originUrl ?? null
        }
      }

      if (isTextLike) {
        const textContent = await fileSystem.readFile(abs, 'utf8')
        return {
          kind: (source.sourceKind === 'url' ? 'url' : 'text') as 'url' | 'text',
          fileName: fileNameFromPath || source.title,
          localUrl,
          textContent,
          originUrl: source.originUrl ?? null
        }
      }

      return {
        kind: 'unsupported' as const,
        fileName: fileNameFromPath || source.title,
        localUrl,
        textContent: null as string | null,
        originUrl: source.originUrl ?? null
      }
    }
  )

  ipcMain.handle('knowledge:get-capabilities', async () => {
    const cfg = await loadKnowledgeConfig()
    const vision = await resolveVisionConfigured()
    return probeExtractEngineCapabilities({
      visionModelConfigured: vision.configured,
      visionModelId: vision.modelId,
      ocrLanguage: cfg.ocrLanguage
    })
  })

  ipcMain.handle('knowledge:get-config', async () => loadKnowledgeConfig())

  ipcMain.handle('knowledge:set-config', async (_e, patch: KnowledgeConfig) => {
    const current = await loadKnowledgeConfig()
    const next = { ...current, ...patch }
    await settingsManager.set('knowledge_config', next)
    resetKnowledgeIngestService()
    return next
  })

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
