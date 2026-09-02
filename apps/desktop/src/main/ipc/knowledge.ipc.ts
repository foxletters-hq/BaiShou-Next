import { ipcMain, BrowserWindow } from 'electron'
import path from 'path'
import { toLocalProtocolFileUrl } from '../local-protocol.util'
import { KnowledgeRepository, knowledgeConnectionManager } from '@baishou/database-desktop'
import {
  KnowledgeIngestService,
  KnowledgeSearchService,
  NotebookGraphRawManager,
  listLiveGraphSourceIds,
  probeExtractEngineCapabilities,
  probePdfPageTexts,
  recommendVisionExtract,
  type ExtractEngineId,
  type KnowledgeExtractProgress
} from '@baishou/core-desktop'
import { KnowledgeEmbeddingStorage, fetchUrlAsMarkdown } from '@baishou/ai'
import {
  clampOcrConcurrency,
  isVisionModel,
  logger,
  notebookCoverImageCandidates,
  normalizeKnowledgeImportProcessMode,
  normalizeNotebookCoverImage,
  type GlobalModelsConfig,
  type KnowledgeConfig,
  type KnowledgeImportProcessMode,
  type AIProviderConfig
} from '@baishou/shared'
import { getNotebookRawManager } from '../services/raw-data-source.runtime'
import {
  reviewNotebookGraphBatch,
  reviewNotebookGraphEdge,
  reviewNotebookGraphNode
} from '../services/notebook-graph-review'
import { createDesktopKnowledgeGraphExtractFn } from '../services/desktop-knowledge-graph-extract'
import { fileSystem } from '../services/node-file-system'
import { scheduleConsumeKnowledgeIngestJobs } from '../services/knowledge-ingest-jobs.consumer'
import { getEmbeddingService } from './rag.ipc'
import { settingsManager } from './settings.ipc'
import { pathService, resolveActiveVaultId } from './vault.ipc'

const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeConfig = {
  defaultExtractEngine: 'simple',
  importProcessMode: 'both',
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

function toCoverImageUrl(absolutePath: string): string {
  return toLocalProtocolFileUrl(absolutePath)
}

async function resolveCoverRelativePath(
  notebookId: string,
  recorded: string | null | undefined
): Promise<string> {
  const manager = getNotebookRawManager()
  const recordedRel = normalizeNotebookCoverImage(notebookId, recorded)
  const candidates = recordedRel
    ? [recordedRel, ...notebookCoverImageCandidates(notebookId).filter((rel) => rel !== recordedRel)]
    : notebookCoverImageCandidates(notebookId)
  for (const rel of candidates) {
    try {
      const abs = await manager.absolutePath(rel)
      if (await fileSystem.exists(abs)) return rel
    } catch {
      /* 路径越界时换下一个候选 */
    }
  }
  return ''
}

async function withCoverImageUrl<T extends { id?: string; coverImage?: string | null }>(
  row: T
): Promise<T & { coverImageUrl: string | null }> {
  const notebookId = typeof row.id === 'string' ? row.id : ''
  if (!notebookId) return { ...row, coverImageUrl: null }
  try {
    const rel = await resolveCoverRelativePath(notebookId, row.coverImage)
    if (!rel) return { ...row, coverImage: row.coverImage ?? '', coverImageUrl: null }
    const abs = await getNotebookRawManager().absolutePath(rel)
    return { ...row, coverImage: rel, coverImageUrl: toCoverImageUrl(abs) }
  } catch {
    return { ...row, coverImageUrl: null }
  }
}

function requireActiveVaultId(): string {
  const id = resolveActiveVaultId()?.trim() || ''
  if (!id) throw new Error('active vault not ready')
  return id
}

async function assertKnowledgeModelMatch(
  repo: KnowledgeRepository,
  notebookIds?: string[]
): Promise<void> {
  const embeddingService = getEmbeddingService()
  const { getEmbeddingConfig } = await import('./rag.ipc')
  const embeddingConfig = getEmbeddingConfig()
  await embeddingConfig.load()
  const modelId = embeddingConfig.getGlobalEmbeddingModelId()
  if (!modelId || !embeddingService.isConfigured) return
  const vaultId = requireActiveVaultId()
  const ids = (notebookIds ?? []).map((id) => id.trim()).filter(Boolean)
  const mismatch = await repo.countHeterogeneousEmbeddings(modelId, {
    vaultId,
    ...(ids.length > 0 ? { notebookIds: ids } : {})
  })
  if (mismatch > 0) {
    throw new Error('knowledge-model-mismatch')
  }
}

async function loadKnowledgeConfig(): Promise<KnowledgeConfig> {
  const raw = (await settingsManager.get<KnowledgeConfig>('knowledge_config')) || {}
  const merged = { ...DEFAULT_KNOWLEDGE_CONFIG, ...raw }
  merged.importProcessMode = normalizeKnowledgeImportProcessMode(merged.importProcessMode)
  return merged
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
        ocrConcurrency: clampOcrConcurrency(cfg.ocrConcurrency),
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
    deleteChunksBySource: (sourceId) => repo.deleteChunksBySource(sourceId),
    extractNotebookGraph: createDesktopKnowledgeGraphExtractFn(),
    deleteNotebookGraphSource: async ({ notebookId, sourceId }) => {
      const raw = new NotebookGraphRawManager(pathService, fileSystem)
      await raw.deleteSourceShards(notebookId, sourceId)
    }
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

function handleKnowledgeIpc(
  channel: string,
  listener: Parameters<typeof ipcMain.handle>[1]
): void {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, listener)
}

export function registerKnowledgeIPC(): void {
  handleKnowledgeIpc(
    'knowledge:create-notebook',
    async (
      _e,
      input: { name: string; description?: string; coverTone?: string; coverIcon?: string }
    ) => {
      const svc = getKnowledgeIngestService()
      return withCoverImageUrl(await svc.createNotebook(input))
    }
  )

  handleKnowledgeIpc('knowledge:list-notebooks', async () => {
    const svc = getKnowledgeIngestService()
    const rows = await svc.listNotebooks()
    return Promise.all(rows.map((row) => withCoverImageUrl(row)))
  })

  handleKnowledgeIpc('knowledge:list-mount-summaries', async () => {
    const repo = requireKnowledgeRepo()
    const vaultId = requireActiveVaultId()
    const notebooks = await repo.listNotebooks({ vaultId })
    const stats = await repo.listNotebookStats(vaultId)
    const statsById = new Map(stats.map((row) => [row.notebookId, row]))
    const profiles = await repo.listNotebookEmbeddingProfiles({
      vaultId,
      notebookIds: notebooks.map((row) => row.id)
    })
    const profilesById = new Map<string, typeof profiles>()
    for (const profile of profiles) {
      const list = profilesById.get(profile.notebookId) ?? []
      list.push(profile)
      profilesById.set(profile.notebookId, list)
    }
    return notebooks.map((notebook) => {
      const stat = statsById.get(notebook.id)
      const notebookProfiles = profilesById.get(notebook.id) ?? []
      const dimensions = [...new Set(notebookProfiles.map((row) => row.dimension))]
      return {
        id: notebook.id,
        name: notebook.name,
        sources: stat?.sources ?? 0,
        chunks: stat?.chunks ?? 0,
        dimension: dimensions.length === 1 ? dimensions[0] : null,
        dimensions,
        modelIds: [...new Set(notebookProfiles.map((row) => row.modelId).filter(Boolean))],
        mixedEmbeddings: dimensions.length > 1
      }
    })
  })

  handleKnowledgeIpc(
    'knowledge:update-notebook',
    async (
      _e,
      input: {
        notebookId: string
        name?: string
        description?: string
        coverTone?: string | null
        coverIcon?: string | null
        coverImage?: string | null
      }
    ) => {
      const svc = getKnowledgeIngestService()
      return withCoverImageUrl(await svc.updateNotebook(input))
    }
  )

  handleKnowledgeIpc(
    'knowledge:set-cover-image',
    async (_e, input: { notebookId: string; absolutePath: string }) => {
      const svc = getKnowledgeIngestService()
      return withCoverImageUrl(await svc.setCoverImage(input))
    }
  )

  handleKnowledgeIpc('knowledge:reorder-notebooks', async (_e, orderedIds: string[]) => {
    const svc = getKnowledgeIngestService()
    const rows = await svc.reorderNotebooks(Array.isArray(orderedIds) ? orderedIds : [])
    return Promise.all(rows.map((row) => withCoverImageUrl(row)))
  })

  handleKnowledgeIpc('knowledge:get-notebook', async (_e, notebookId: string) => {
    const repo = requireKnowledgeRepo()
    const row = await repo.getNotebook(String(notebookId || ''))
    return row ? withCoverImageUrl(row) : null
  })

  handleKnowledgeIpc('knowledge:list-notebook-stats', async () => {
    const repo = requireKnowledgeRepo()
    return repo.listNotebookStats(requireActiveVaultId())
  })

  handleKnowledgeIpc(
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
        importProcessMode?: KnowledgeImportProcessMode
      }
    ) => {
      const svc = getKnowledgeIngestService()
      const cfg = await loadKnowledgeConfig()
      let payload = { ...input }

      if (input.kind === 'url') {
        const originUrl = (input.originUrl || input.textContent || '').trim()
        if (!originUrl) throw new Error('import url requires originUrl')
        const fetched = await fetchUrlAsMarkdown(originUrl, { allowPrivateNetwork: true })
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

      const importProcessMode = normalizeKnowledgeImportProcessMode(input.importProcessMode)
      const result = await svc.importSource({
        ...payload,
        importProcessMode,
        extractEngine: input.extractEngine || cfg.defaultExtractEngine || 'simple',
        fileName:
          payload.fileName ||
          (payload.absolutePath ? path.basename(payload.absolutePath) : payload.title)
      })
      scheduleConsumeKnowledgeIngestJobs('after-import')
      return result
    }
  )

  handleKnowledgeIpc(
    'knowledge:probe-extract-hint',
    async (_e, input: { absolutePath?: string; sourceId?: string }) => {
      let filePath = String(input?.absolutePath || '').trim()
      let fileName = filePath ? path.basename(filePath) : ''
      if (!filePath && input?.sourceId) {
        const repo = requireKnowledgeRepo()
        const source = await repo.getSource(String(input.sourceId))
        if (!source?.relativePath) throw new Error('source file not found')
        filePath = await getNotebookRawManager().absolutePath(source.relativePath)
        fileName = source.title || path.basename(filePath)
      }
      if (!filePath) throw new Error('absolutePath or sourceId required')
      const vision = await resolveVisionConfigured()
      const ext = path.extname(filePath).toLowerCase()
      if (ext !== '.pdf') {
        return {
          recommendVision: false,
          reason: null,
          sampledPages: 0,
          usableTextPages: 0,
          garbledPages: 0,
          emptyPages: 0,
          fileName,
          visionConfigured: vision.configured,
          visionModelId: vision.modelId
        }
      }
      const pages = await probePdfPageTexts(filePath, 12)
      const hint = recommendVisionExtract(pages)
      return {
        ...hint,
        fileName,
        visionConfigured: vision.configured,
        visionModelId: vision.modelId
      }
    }
  )

  handleKnowledgeIpc('knowledge:retry-source', async (_e, sourceId: string) => {
    const svc = getKnowledgeIngestService()
    await svc.retrySource(sourceId)
    scheduleConsumeKnowledgeIngestJobs('after-retry')
    return { ok: true }
  })

  handleKnowledgeIpc(
    'knowledge:reprocess-source',
    async (_e, input: { sourceId: string; target: 'embed' | 'graph' }) => {
      const sourceId = String(input?.sourceId || '')
      const target = input?.target === 'graph' ? 'graph' : 'embed'
      const svc = getKnowledgeIngestService()
      await svc.reprocessSource(sourceId, target)
      scheduleConsumeKnowledgeIngestJobs('after-reprocess')
      return { ok: true }
    }
  )

  handleKnowledgeIpc('knowledge:delete-source', async (_e, sourceId: string) => {
    const svc = getKnowledgeIngestService()
    await svc.deleteSource(String(sourceId || ''))
    return { ok: true }
  })

  handleKnowledgeIpc('knowledge:rebuild-index', async (_e, notebookId: string) => {
    const svc = getKnowledgeIngestService()
    await svc.rebuildIndex(notebookId)
    scheduleConsumeKnowledgeIngestJobs('after-rebuild')
    return { ok: true }
  })

  handleKnowledgeIpc('knowledge:get-stats', async (_e, notebookId?: string) => {
    const repo = requireKnowledgeRepo()
    return repo.getStats(notebookId, requireActiveVaultId())
  })

  handleKnowledgeIpc(
    'knowledge:has-model-mismatch',
    async (_e, notebookIds?: string[]) => {
      const repo = requireKnowledgeRepo()
      const embeddingService = getEmbeddingService()
      const { getEmbeddingConfig } = await import('./rag.ipc')
      const embeddingConfig = getEmbeddingConfig()
      await embeddingConfig.load()
      const modelId = embeddingConfig.getGlobalEmbeddingModelId()
      if (!modelId || !embeddingService.isConfigured) return false
      const vaultId = requireActiveVaultId()
      const ids = (notebookIds ?? []).map((id) => String(id).trim()).filter(Boolean)
      const count = await repo.countHeterogeneousEmbeddings(modelId, {
        vaultId,
        ...(ids.length > 0 ? { notebookIds: ids } : {})
      })
      return count > 0
    }
  )

  handleKnowledgeIpc('knowledge:list-sources', async (_e, notebookId: string) => {
    const repo = requireKnowledgeRepo()
    return repo.listSources(notebookId)
  })

  handleKnowledgeIpc(
    'knowledge:list-chunks',
    async (
      _e,
      input: { notebookId: string; limit?: number; offset?: number; query?: string }
    ) => {
      const notebookId = String(input?.notebookId || '').trim()
      if (!notebookId) throw new Error('notebookId required')
      const repo = requireKnowledgeRepo()
      return repo.listChunksByNotebook({
        notebookId,
        limit: input.limit,
        offset: input.offset,
        query: input.query
      })
    }
  )

  handleKnowledgeIpc(
    'knowledge:search',
    async (_e, input: { notebookId: string; query: string; topK?: number }) => {
      const repo = requireKnowledgeRepo()
      await assertKnowledgeModelMatch(repo, [input.notebookId])
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

  handleKnowledgeIpc('knowledge:list-graph-jobs', async (_e, notebookId: string) => {
    const id = String(notebookId || '').trim()
    if (!id) throw new Error('notebookId required')
    const repo = requireKnowledgeRepo()
    const jobs = (await repo.listIngestJobs()).filter(
      (job) => job.notebookId === id && job.stage === 'graph'
    )
    const live = new Set(listLiveGraphSourceIds())
    const sources = await repo.listSources(id)
    const titleById = new Map(sources.map((row) => [row.id, row.title]))
    const items = jobs.map((job) => ({
      sourceId: job.sourceId,
      title: titleById.get(job.sourceId) || job.sourceId,
      status: live.has(job.sourceId) ? 'running' : job.status,
      lastError: job.lastError
    }))
    const running = items.find((item) => item.status === 'running')
    return {
      pending: items.filter((item) => item.status === 'pending' || item.status === 'running').length,
      running: items.filter((item) => item.status === 'running').length,
      failed: items.filter((item) => item.status === 'failed').length,
      currentSourceId: running?.sourceId ?? null,
      currentSourceTitle: running?.title ?? null,
      items
    }
  })

  handleKnowledgeIpc(
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

  handleKnowledgeIpc('knowledge:cancel-extract', async (_e, sourceId: string) => {
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

  handleKnowledgeIpc('knowledge:recover-stale', async () => {
    const svc = getKnowledgeIngestService()
    const result = await svc.recoverStaleIngestState()
    scheduleConsumeKnowledgeIngestJobs('recover')
    return result
  })

  handleKnowledgeIpc(
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
          fileBytes: null as Uint8Array | null,
          textContent: null as string | null,
          originUrl: source.originUrl ?? null
        }
      }

      const abs = await notebookManager.absolutePath(source.relativePath)
      const localUrl = toLocalProtocolFileUrl(abs)
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
          fileBytes: null as Uint8Array | null,
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
          fileBytes: null as Uint8Array | null,
          textContent,
          originUrl: source.originUrl ?? null
        }
      }

      return {
        kind: 'unsupported' as const,
        fileName: fileNameFromPath || source.title,
        localUrl,
        fileBytes: null as Uint8Array | null,
        textContent: null as string | null,
        originUrl: source.originUrl ?? null
      }
    }
  )

  handleKnowledgeIpc('knowledge:get-capabilities', async () => {
    const cfg = await loadKnowledgeConfig()
    const vision = await resolveVisionConfigured()
    return probeExtractEngineCapabilities({
      visionModelConfigured: vision.configured,
      visionModelId: vision.modelId,
      ocrLanguage: cfg.ocrLanguage
    })
  })

  handleKnowledgeIpc('knowledge:get-config', async () => loadKnowledgeConfig())

  handleKnowledgeIpc('knowledge:set-config', async (_e, patch: KnowledgeConfig) => {
    const current = await loadKnowledgeConfig()
    const next = { ...current, ...patch }
    if (next.ocrConcurrency !== undefined) {
      next.ocrConcurrency = clampOcrConcurrency(next.ocrConcurrency)
    }
    if (patch.importProcessMode !== undefined) {
      next.importProcessMode = normalizeKnowledgeImportProcessMode(patch.importProcessMode)
    }
    await settingsManager.set('knowledge_config', next)
    resetKnowledgeIngestService()
    return next
  })

  handleKnowledgeIpc(
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

  handleKnowledgeIpc(
    'knowledge:get-graph-view',
    async (_e, input: { notebookId: string; maxNodes?: number }) => {
      const notebookId = String(input?.notebookId || '').trim()
      if (!notebookId) throw new Error('notebookId required')
      requireKnowledgeRepo()
      const { NotebookGraphRepository } = await import('@baishou/database-desktop')
      const repo = new NotebookGraphRepository(knowledgeConnectionManager.getDb())
      return repo.getView({
        vaultId: requireActiveVaultId(),
        notebookId,
        maxNodes: input.maxNodes
      })
    }
  )

  handleKnowledgeIpc(
    'knowledge:graph-search',
    async (_e, input: { notebookId: string; query: string; limit?: number }) => {
      const notebookId = String(input?.notebookId || '').trim()
      if (!notebookId) throw new Error('notebookId required')
      requireKnowledgeRepo()
      const { NotebookGraphRepository } = await import('@baishou/database-desktop')
      const repo = new NotebookGraphRepository(knowledgeConnectionManager.getDb())
      return repo.searchNodes({
        vaultId: requireActiveVaultId(),
        notebookId,
        query: String(input.query || ''),
        limit: input.limit
      })
    }
  )

  handleKnowledgeIpc(
    'knowledge:set-graph-node-review',
    async (
      _e,
      input: { notebookId: string; nodeId: string; reviewStatus: 'approved' | 'rejected' }
    ) => reviewNotebookGraphNode(input)
  )

  handleKnowledgeIpc(
    'knowledge:set-graph-edge-review',
    async (
      _e,
      input: { notebookId: string; edgeId: string; reviewStatus: 'approved' | 'rejected' }
    ) => reviewNotebookGraphEdge(input)
  )

  handleKnowledgeIpc(
    'knowledge:set-graph-reviews-batch',
    async (
      _e,
      input: {
        notebookId: string
        reviewStatus: 'approved' | 'rejected'
        nodeIds?: string[]
        edgeIds?: string[]
        allPending?: boolean
      }
    ) => reviewNotebookGraphBatch(input)
  )

  handleKnowledgeIpc('knowledge:rebuild-graph', async (_e, notebookId: string) => {
    const svc = getKnowledgeIngestService()
    await svc.rebuildNotebookGraph(String(notebookId || ''))
    scheduleConsumeKnowledgeIngestJobs('after-rebuild-graph')
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      try {
        win.webContents.send('knowledge:graph-progress', { at: Date.now() })
      } catch {
        /* ignore */
      }
    }
    return { ok: true }
  })

  logger.info('[KnowledgeIPC] handlers registered')
}
