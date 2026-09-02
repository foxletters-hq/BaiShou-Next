import {
  deriveLegacyVaultId,
  EMBEDDING_NOT_CONFIGURED,
  KNOWLEDGE_MODEL_MISMATCH,
  parseMountedNotebookIds,
  type ToolKnowledgeGraphSearchResult
} from '@baishou/shared'
import {
  expoKnowledgeConnectionManager,
  KnowledgeRepository,
  type ExpoSqliteDatabase
} from '@baishou/database/expo'
import {
  KnowledgeSearchService,
  searchMountedKnowledgeNotebooks,
  searchNotebookGraphForTool,
  type KnowledgeSqlExecutor
} from '@baishou/core-mobile'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import {
  ensureMobileRawDataRuntime,
  getMobileNotebookRawManager,
  resolveMobileEmbeddingForHydration
} from './mobile-raw-data-source.runtime'
import { createMobileFileSystem } from './create-mobile-file-system'

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

export async function mobileListMountSummaries() {
  const repo = requireRepo()
  const vaultId = await resolveMobileActiveVaultId()
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
      dimension: dimensions.length === 1 ? dimensions[0]! : null,
      mixedEmbeddings: dimensions.length > 1
    }
  })
}

export async function mobileListSources(notebookId: string) {
  return requireRepo().listSources(notebookId)
}

export async function mobileGetKnowledgeStats(notebookId?: string) {
  return requireRepo().getStats(notebookId, await resolveMobileActiveVaultId())
}

export async function mobileListNotebookStats() {
  return requireRepo().listNotebookStats(await resolveMobileActiveVaultId())
}

export async function mobileGetNotebookGraphView(notebookId: string, maxNodes = 80) {
  const id = notebookId.trim()
  if (!id) throw new Error('notebookId required')
  const { NotebookGraphRepository } = await import('@baishou/database/expo')
  const repo = new NotebookGraphRepository(expoKnowledgeConnectionManager.getDb())
  return repo.getView({
    vaultId: await resolveMobileActiveVaultId(),
    notebookId: id,
    maxNodes
  })
}

export async function mobileSearchNotebookGraph(opts: {
  query: string
  notebookId?: string
  notebookIds?: string[]
  limit?: number
}) {
  const notebookIds = parseMountedNotebookIds(opts.notebookIds ?? opts.notebookId)
  if (notebookIds.length === 0) throw new Error('notebookId required')
  const { NotebookGraphRepository } = await import('@baishou/database/expo')
  const repo = new NotebookGraphRepository(expoKnowledgeConnectionManager.getDb())
  const knowledgeRepo = requireRepo()
  const vaultId = await resolveMobileActiveVaultId()
  const notebooks = await knowledgeRepo.listNotebooks({ vaultId })
  const nameById = new Map(notebooks.map((row) => [row.id, row.name]))
  const groups: ToolKnowledgeGraphSearchResult[] = []
  for (const notebookId of notebookIds) {
    const result = await searchNotebookGraphForTool(repo, {
      vaultId,
      notebookId,
      query: opts.query,
      limit: opts.limit
    })
    groups.push({
      notebookId,
      notebookName: nameById.get(notebookId) || notebookId,
      nodes: result.nodes.map((node) => ({ ...node, notebookId })),
      edges: result.edges.map((edge) => ({ ...edge, notebookId })),
      paths: result.paths
    })
  }
  return groups
}

export async function mobileHasKnowledgeModelMismatch(notebookIds?: string[]): Promise<boolean> {
  const runtime = agentDbRuntimeRef.current
  if (!runtime?.settingsManager) return false
  const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
  if (!emb.embeddingModelId) return false
  const ids = parseMountedNotebookIds(notebookIds)
  const count = await requireRepo().countHeterogeneousEmbeddings(emb.embeddingModelId, {
    vaultId: await resolveMobileActiveVaultId(),
    ...(ids.length > 0 ? { notebookIds: ids } : {})
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
  const { scheduleConsumeMobileKnowledgeIngestJobs } =
    await import('./mobile-knowledge-ingest-jobs.consumer')
  scheduleConsumeMobileKnowledgeIngestJobs('mobile-rebuild')
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
    const fetched = await fetchUrlAsMarkdown(originUrl, { allowPrivateNetwork: true })
    if (!fetched.markdown?.trim()) throw new Error('URL content empty or could not be parsed')
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

  const { scheduleConsumeMobileKnowledgeIngestJobs } =
    await import('./mobile-knowledge-ingest-jobs.consumer')
  scheduleConsumeMobileKnowledgeIngestJobs('after-mobile-import')
  return result
}

/** 供 Agent knowledge_search 工具注入 */
export async function mobileSearchKnowledge(opts: {
  query: string
  notebookId?: string
  notebookIds?: string[]
  limit?: number
  limitPerNotebook?: number
}): Promise<
  Array<{
    chunkId: string
    sourceId: string
    notebookId: string
    notebookName?: string
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
  const notebookIds = parseMountedNotebookIds(opts.notebookIds ?? opts.notebookId)
  if (notebookIds.length === 0) throw new Error('notebookId required')
  const mismatch = await mobileHasKnowledgeModelMismatch(notebookIds)
  if (mismatch) {
    throw new Error(KNOWLEDGE_MODEL_MISMATCH)
  }
  const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
  if (!emb.embeddingProvider || !emb.embeddingModelId) {
    throw new Error(EMBEDDING_NOT_CONFIGURED)
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
  const vaultId = await resolveMobileActiveVaultId()
  const profiles = await repo.listNotebookEmbeddingProfiles({ vaultId, notebookIds })
  const { embed } = await import('ai')
  const model = emb.embeddingProvider.getEmbeddingModel(emb.embeddingModelId) as never
  const { embedding } = await embed({ model, value: opts.query })
  return searchMountedKnowledgeNotebooks({
    query: opts.query,
    notebookIds,
    queryVector: Array.from(embedding),
    currentModelId: emb.embeddingModelId,
    profiles,
    search,
    limit: opts.limit,
    limitPerNotebook: opts.limitPerNotebook
  })
}
