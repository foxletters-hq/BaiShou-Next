import {
  EMBEDDING_NOT_CONFIGURED,
  KNOWLEDGE_MODEL_MISMATCH,
  parseMountedNotebookIds,
  type ToolKnowledgeGraphSearchResult
} from '@baishou/shared'
import { expoKnowledgeConnectionManager } from '@baishou/database/expo'
import {
  KnowledgeSearchService,
  listLiveIngestSourceIds,
  searchMountedKnowledgeNotebooks,
  searchNotebookGraphForTool
} from '@baishou/core-mobile'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import { resolveMobileEmbeddingForHydration } from './mobile-raw-data-source.runtime'
import {
  createKnowledgeSqlExecutor,
  ensureMobileKnowledgeConnected,
  ensureMobileKnowledgeRepo,
  resolveMobileActiveVaultId
} from './mobile-knowledge-repo'

async function hasKnowledgeModelMismatch(notebookIds: string[]): Promise<boolean> {
  const runtime = agentDbRuntimeRef.current
  if (!runtime?.settingsManager) return false
  const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
  if (!emb.embeddingModelId) return false
  const count = await (
    await ensureMobileKnowledgeRepo()
  ).countHeterogeneousEmbeddings(emb.embeddingModelId, {
    vaultId: await resolveMobileActiveVaultId(),
    notebookIds
  })
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
  await ensureMobileKnowledgeConnected()
  const notebookIds = parseMountedNotebookIds(opts.notebookIds ?? opts.notebookId)
  if (notebookIds.length === 0) throw new Error('notebookId required')
  if (await hasKnowledgeModelMismatch(notebookIds)) {
    throw new Error(KNOWLEDGE_MODEL_MISMATCH)
  }
  const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
  if (!emb.embeddingProvider || !emb.embeddingModelId) {
    throw new Error(EMBEDDING_NOT_CONFIGURED)
  }
  const repo = await ensureMobileKnowledgeRepo()
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
  return (await ensureMobileKnowledgeRepo()).listChunksByNotebook({
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
  await ensureMobileKnowledgeConnected()
  const { NotebookGraphRepository } = await import('@baishou/database/expo')
  const repo = new NotebookGraphRepository(expoKnowledgeConnectionManager.getDb())
  return repo.searchNodes({
    vaultId: await resolveMobileActiveVaultId(),
    notebookId,
    query: input.query,
    limit: input.limit
  })
}

export function overlayMobileOrganizeJobsLive<T extends { sourceId: string; status: string }>(
  items: T[]
): T[] {
  const live = new Set(listLiveIngestSourceIds())
  return items.map((item) => {
    if (item.status === 'failed') return item
    if (live.has(item.sourceId)) return { ...item, status: 'running' }
    if (item.status === 'running') return { ...item, status: 'pending' }
    return item
  })
}

export async function mobileListNotebookOrganizeJobs(notebookId: string) {
  const id = notebookId.trim()
  if (!id) throw new Error('notebookId required')
  const repo = await ensureMobileKnowledgeRepo()
  const jobs = await repo.listIngestJobs({ notebookId: id })
  const sources = await repo.listSources(id)
  const titleById = new Map(sources.map((row) => [row.id, row.title]))
  const items = overlayMobileOrganizeJobsLive(
    jobs.map((job) => ({
      sourceId: job.sourceId,
      title: titleById.get(job.sourceId) || job.sourceId,
      stage: job.stage,
      status: job.status,
      lastError: job.lastError
    }))
  )
  const graphItems = items.filter((item) => item.stage === 'graph')
  const running = graphItems.find((item) => item.status === 'running')
  return {
    pending: graphItems.filter((item) => item.status === 'pending' || item.status === 'running')
      .length,
    running: graphItems.filter((item) => item.status === 'running').length,
    failed: graphItems.filter((item) => item.status === 'failed').length,
    currentSourceId: running?.sourceId ?? null,
    currentSourceTitle: running?.title ?? null,
    items
  }
}

export async function mobileListNotebookGraphJobs(notebookId: string) {
  const listed = await mobileListNotebookOrganizeJobs(notebookId)
  return {
    ...listed,
    items: listed.items.filter((item) => item.stage === 'graph')
  }
}

export async function mobileGetNotebookGraphView(notebookId: string, maxNodes = 80) {
  const id = notebookId.trim()
  if (!id) throw new Error('notebookId required')
  await ensureMobileKnowledgeConnected()
  const { NotebookGraphRepository } = await import('@baishou/database/expo')
  const repo = new NotebookGraphRepository(expoKnowledgeConnectionManager.getDb())
  return repo.getView({
    vaultId: await resolveMobileActiveVaultId(),
    notebookId: id,
    maxNodes
  })
}

export async function mobileListNotebookGraphNodesPage(opts: {
  notebookId: string
  keyword?: string
  limit?: number
  offset?: number
}) {
  const id = opts.notebookId.trim()
  if (!id) throw new Error('notebookId required')
  await ensureMobileKnowledgeConnected()
  const { NotebookGraphRepository } = await import('@baishou/database/expo')
  const repo = new NotebookGraphRepository(expoKnowledgeConnectionManager.getDb())
  return repo.listNodesPage({
    vaultId: await resolveMobileActiveVaultId(),
    notebookId: id,
    keyword: opts.keyword,
    limit: opts.limit,
    offset: opts.offset
  })
}

export async function mobileCountNotebookGraph(notebookId: string, keyword?: string) {
  const id = notebookId.trim()
  if (!id) throw new Error('notebookId required')
  await ensureMobileKnowledgeConnected()
  const { NotebookGraphRepository } = await import('@baishou/database/expo')
  const repo = new NotebookGraphRepository(expoKnowledgeConnectionManager.getDb())
  const vaultId = await resolveMobileActiveVaultId()
  const [nodeCount, edgeCount, filteredNodeCount] = await Promise.all([
    repo.countNodes({ vaultId, notebookId: id }),
    repo.countCurrentEdges({ vaultId, notebookId: id }),
    keyword?.trim() ? repo.countNodes({ vaultId, notebookId: id, keyword }) : Promise.resolve(0)
  ])
  return {
    nodeCount,
    edgeCount,
    filteredNodeCount: keyword?.trim() ? filteredNodeCount : nodeCount
  }
}

export async function mobileSearchNotebookGraph(opts: {
  query: string
  notebookId?: string
  notebookIds?: string[]
  limit?: number
}) {
  const notebookIds = parseMountedNotebookIds(opts.notebookIds ?? opts.notebookId)
  if (notebookIds.length === 0) throw new Error('notebookId required')
  await ensureMobileKnowledgeConnected()
  const { NotebookGraphRepository } = await import('@baishou/database/expo')
  const repo = new NotebookGraphRepository(expoKnowledgeConnectionManager.getDb())
  const knowledgeRepo = await ensureMobileKnowledgeRepo()
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

export async function mobileGetNotebookGraphNodePage(notebookId: string, nodeId: string) {
  const nb = notebookId.trim()
  const id = nodeId.trim()
  if (!nb) throw new Error('notebookId required')
  if (!id) throw new Error('nodeId required')
  await ensureMobileKnowledgeConnected()
  const { NotebookGraphRepository } = await import('@baishou/database/expo')
  const repo = new NotebookGraphRepository(expoKnowledgeConnectionManager.getDb())
  const vaultId = await resolveMobileActiveVaultId()
  const node = await repo.getNodeById(id, vaultId, nb)
  const touching = (await repo.listEdgesTouching(vaultId, nb, id)).filter(
    (edge) => edge.isCurrent !== 0
  )
  const partnerIds = [
    ...new Set(
      touching
        .map((edge) => (edge.fromId === id ? edge.toId : edge.fromId))
        .filter((other) => other !== id)
    )
  ]
  const partners = (
    await Promise.all(partnerIds.map((partnerId) => repo.getNodeById(partnerId, vaultId, nb)))
  ).filter((row): row is NonNullable<typeof row> => Boolean(row))
  return { vaultId, node, edges: touching, partners }
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
