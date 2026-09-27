import {
  EMBEDDING_NOT_CONFIGURED,
  KNOWLEDGE_MODEL_MISMATCH,
  parseMountedNotebookIds,
  type ToolKnowledgeGraphSearchResult
} from '@baishou/shared'
import { expoKnowledgeConnectionManager } from '@baishou/database/expo'
import {
  KnowledgeSearchService,
  searchMountedKnowledgeNotebooks,
  searchNotebookGraphForTool
} from '@baishou/core-mobile'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import { resolveMobileEmbeddingForHydration } from './mobile-raw-data-source.runtime'
import {
  createKnowledgeSqlExecutor,
  requireMobileKnowledgeRepo,
  resolveMobileActiveVaultId
} from './mobile-knowledge-repo'

async function hasKnowledgeModelMismatch(notebookIds: string[]): Promise<boolean> {
  const runtime = agentDbRuntimeRef.current
  if (!runtime?.settingsManager) return false
  const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
  if (!emb.embeddingModelId) return false
  const count = await requireMobileKnowledgeRepo().countHeterogeneousEmbeddings(
    emb.embeddingModelId,
    {
      vaultId: await resolveMobileActiveVaultId(),
      notebookIds
    }
  )
  return count > 0
}

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
  if (await hasKnowledgeModelMismatch(notebookIds)) {
    throw new Error(KNOWLEDGE_MODEL_MISMATCH)
  }
  const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
  if (!emb.embeddingProvider || !emb.embeddingModelId) {
    throw new Error(EMBEDDING_NOT_CONFIGURED)
  }
  const repo = requireMobileKnowledgeRepo()
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

export async function mobileListKnowledgeChunks(input: {
  notebookId: string
  limit?: number
  offset?: number
  query?: string
}) {
  const notebookId = input.notebookId.trim()
  if (!notebookId) throw new Error('notebookId required')
  return requireMobileKnowledgeRepo().listChunksByNotebook({
    notebookId,
    limit: input.limit,
    offset: input.offset,
    query: input.query
  })
}

export async function mobileSearchNotebookGraphNodes(input: {
  notebookId: string
  query: string
  limit?: number
}) {
  const notebookId = input.notebookId.trim()
  if (!notebookId) throw new Error('notebookId required')
  const { NotebookGraphRepository } = await import('@baishou/database/expo')
  const repo = new NotebookGraphRepository(expoKnowledgeConnectionManager.getDb())
  return repo.searchNodes({
    vaultId: await resolveMobileActiveVaultId(),
    notebookId,
    query: input.query,
    limit: input.limit
  })
}

export async function mobileListNotebookGraphJobs(notebookId: string) {
  const id = notebookId.trim()
  if (!id) throw new Error('notebookId required')
  const repo = requireMobileKnowledgeRepo()
  const { listLiveGraphSourceIds } = await import('@baishou/core-mobile')
  const jobs = await repo.listIngestJobs({ notebookId: id, stage: 'graph' })
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
  const knowledgeRepo = requireMobileKnowledgeRepo()
  const vaultId = await resolveMobileActiveVaultId()
  const notebooks = await knowledgeRepo.listNotebooks({ vaultId })
  const nameById = new Map(notebooks.map((row) => [row.id, row.name]))
  const { embedQuery, modelId } = await resolveMobileNotebookGraphEmbed()
  const groups: ToolKnowledgeGraphSearchResult[] = []
  for (const notebookId of notebookIds) {
    const result = await searchNotebookGraphForTool(repo, {
      vaultId,
      notebookId,
      query: opts.query,
      limit: opts.limit,
      embedQuery,
      modelId
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

async function resolveMobileNotebookGraphEmbed(): Promise<{
  embedQuery?: (text: string) => Promise<number[] | null>
  modelId?: string
}> {
  const runtime = agentDbRuntimeRef.current
  if (!runtime?.settingsManager) return {}
  const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
  if (!emb.embeddingProvider || !emb.embeddingModelId) return {}
  const provider = emb.embeddingProvider
  const modelId = emb.embeddingModelId
  return {
    modelId,
    embedQuery: async (text) => {
      const { embed } = await import('ai')
      const model = provider.getEmbeddingModel(modelId) as never
      const { embedding } = await embed({ model, value: text })
      return Array.from(embedding)
    }
  }
}
