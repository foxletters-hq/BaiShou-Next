import {
  GraphLlmExtractionService,
  GraphSyncService,
  GraphRagService,
  bindPendingReextractCollaborators,
  createDefaultGraphExtractLlm,
  estimateExtractionCost,
  mergeDiaryGraphNodeGroup,
  mergeDiaryGraphNodes,
  applyDiaryGraphSurgicalDelete,
  syncDiaryGraphMergeGroupIntoIndex,
  syncDiaryGraphMergeIntoIndex,
  type GraphExtractAlignDeps,
  type GraphExtractDraft,
  type GraphRawManager,
  type IFileSystem,
  type IStoragePathService
} from '@baishou/core-mobile'
import {
  GRAPH_EDGE_TYPES,
  GRAPH_NODE_TYPES,
  GraphRepository,
  type AppDatabase,
  type ShadowIndexRepository
} from '@baishou/database'
import { AIProviderRegistry, type IAIProvider } from '@baishou/ai'
import type { SettingsManagerService } from '@baishou/core-mobile'
import {
  DIARY_EMBED_GROUP_ID,
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  getUserProfileFromSettings,
  isDiaryEmbeddingPresent,
  normalizeGraphFilePath,
  resolveGlobalGraphModelIds,
  resolveGraphExtractSelfName,
  graphDiaryInstant,
  graphEdgeId,
  graphNodeIdForEntity,
  graphSameNameExistingFromRow,
  GRAPH_GLOBAL_MAX_NODES,
  expandApprovedGraphReviewEdgeIds,
  isGraphReviewStatus,
  uniqueNonEmptyIds,
  type GraphNodeWriteResult,
  type GlobalModelsConfig,
  type GraphExtractQueueProgressUpdate,
  type GraphExtractQueuePhase,
  type GraphSetReviewsBatchInput
} from '@baishou/shared'
import { memoryEmbeddingsTable } from '@baishou/database'
import { and, eq } from 'drizzle-orm'
import i18n from 'i18next'
import {
  ensureMobileRawDataRuntime,
  syncMobileGraphPendingIndex
} from './mobile-raw-data-source.runtime'

let boundVault: string | null = null

export function ensureMobileGraphFreshnessBound(options: {
  vaultName: string
  vaultId: string
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
}) {
  const { freshness, graphManager } = ensureMobileRawDataRuntime(options)
  if (boundVault !== options.vaultName) {
    bindPendingReextractCollaborators({
      freshness,
      graphManager,
      shadowRepo: options.shadowRepo,
      getVaultName: () => options.vaultName,
      getVaultId: () => options.vaultId
    })
    boundVault = options.vaultName
  }
  return freshness
}

export function wireMobilePendingReextractHook(options: {
  vaultName: string
  vaultId: string
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
  shadowSync: { setPendingReextractHook: (hook: any) => void }
}): void {
  const freshness = ensureMobileGraphFreshnessBound(options)
  options.shadowSync.setPendingReextractHook((filePath: string, contentHash: string) => {
    freshness.markPendingReextract(filePath, contentHash)
  })
}

async function resolveChatLlm(
  settingsManager: SettingsManagerService
): Promise<{ provider: IAIProvider; modelId: string } | null> {
  try {
    const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
    const { providerId, modelId } = resolveGlobalGraphModelIds(globalModels)
    if (!providerId) return null
    const providers = (await settingsManager.get<Array<{ id: string }>>('ai_providers')) || []
    const cfg = providers.find((p) => p.id === providerId)
    if (!cfg) return null
    const provider = AIProviderRegistry.getInstance().getOrUpdateProvider(cfg as never)
    return { provider, modelId }
  } catch {
    return null
  }
}

export async function mobileListPendingReextract(options: {
  vaultName: string
  vaultId: string
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
}) {
  const freshness = ensureMobileGraphFreshnessBound(options)
  return freshness.listPendingReextract()
}

export async function mobileExtractDiaries(options: {
  vaultId: string
  vaultName: string
  drizzleDb: AppDatabase
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
  settingsManager: SettingsManagerService
  filePaths?: string[]
  signal?: AbortSignal
  onProgress?: (p: { current: number; total: number; filePath: string }) => void
}) {
  const service = await buildMobileExtractionService(options)
  return service.extractDiaries({
    vaultId: options.vaultId,
    vaultName: options.vaultName,
    selfName: await resolveMobileExtractSelfName(options.settingsManager),
    filePaths: options.filePaths,
    signal: options.signal,
    onProgress: options.onProgress
  })
}

export async function resolveMobileGraphExtractAlignDeps(options: {
  vaultId: string
  vaultName: string
  drizzleDb: AppDatabase
  shadowRepo: ShadowIndexRepository
  settingsManager: SettingsManagerService
}): Promise<GraphExtractAlignDeps> {
  let embedQuery: GraphExtractAlignDeps['embedQuery']
  let modelId: string | undefined
  try {
    const { EmbeddingAdapter } = await import('@baishou/ai')
    const { resolveMobileEmbeddingForHydration } = await import('./mobile-raw-data-source.runtime')
    const emb = await resolveMobileEmbeddingForHydration(options.settingsManager)
    if (emb.embeddingProvider && emb.embeddingModelId) {
      const adapter = new EmbeddingAdapter(emb.embeddingProvider, emb.embeddingModelId)
      if (adapter.isConfigured) {
        embedQuery = (text) => adapter.embedQuery(text)
        modelId = adapter.embeddingModelId
      }
    }
  } catch {
    embedQuery = undefined
  }

  const embeddedSourceIds = new Set<string>()
  try {
    const rows = await options.drizzleDb
      .select({ sourceId: memoryEmbeddingsTable.sourceId })
      .from(memoryEmbeddingsTable)
      .where(
        and(
          eq(memoryEmbeddingsTable.sourceType, 'diary'),
          eq(memoryEmbeddingsTable.vaultId, options.vaultId),
          eq(memoryEmbeddingsTable.groupId, DIARY_EMBED_GROUP_ID)
        )
      )
    for (const row of rows) {
      if (row.sourceId) embeddedSourceIds.add(String(row.sourceId))
    }
  } catch {
    // table may be missing in tests
  }

  const diaryIdByPath = new Map<string, string>()
  try {
    const records = await options.shadowRepo.getAllRecords()
    for (const row of records) {
      diaryIdByPath.set(normalizeGraphFilePath(row.filePath), String(row.id))
    }
  } catch {
    // ignore
  }

  return {
    embedQuery,
    modelId,
    isEmbeddingConfigured: () => Boolean(embedQuery),
    isDiaryEmbedded: (filePath) => {
      const diaryId = diaryIdByPath.get(normalizeGraphFilePath(filePath))
      if (!diaryId) return false
      return isDiaryEmbeddingPresent(options.vaultId, diaryId, embeddedSourceIds)
    }
  }
}

export async function mobileExtractDraft(options: {
  vaultId: string
  vaultName: string
  drizzleDb: AppDatabase
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
  settingsManager: SettingsManagerService
  filePath: string
  signal?: AbortSignal
  onProgress?: (update: GraphExtractQueueProgressUpdate) => void
}) {
  const service = await buildMobileExtractionService(options)
  return service.extractDraft({
    vaultId: options.vaultId,
    vaultName: options.vaultName,
    selfName: await resolveMobileExtractSelfName(options.settingsManager),
    filePath: options.filePath,
    signal: options.signal,
    onProgress: options.onProgress
  })
}

export async function mobileCommitGraphDrafts(
  options: {
    vaultId: string
    vaultName: string
    drizzleDb: AppDatabase
    shadowRepo: ShadowIndexRepository
    pathService: IStoragePathService
    fileSystem: IFileSystem
    settingsManager: SettingsManagerService
  },
  drafts: GraphExtractDraft[],
  signal?: AbortSignal,
  onPhase?: (phase: GraphExtractQueuePhase, detail?: string) => void
) {
  const service = await buildMobileExtractionService(options)
  return service.commitDrafts(drafts, signal, onPhase)
}

async function resolveMobileExtractSelfName(settingsManager: SettingsManagerService): Promise<string> {
  const flag = await settingsManager.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)
  const profile = await getUserProfileFromSettings(settingsManager)
  const selfName = resolveGraphExtractSelfName(flag === true, profile?.nickname)
  if (!selfName) {
    throw new Error(GRAPH_SELF_NAME_REQUIRED_ERROR)
  }
  return selfName
}

async function buildMobileExtractionService(options: {
  vaultId: string
  vaultName: string
  drizzleDb: AppDatabase
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
  settingsManager: SettingsManagerService
}) {
  const freshness = ensureMobileGraphFreshnessBound(options)
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const llmDeps = await resolveChatLlm(options.settingsManager)
  if (!llmDeps) {
    throw new Error(
      i18n.t(
        'auto.apps.mobile.src.services.mobile.graph.service.L93',
        '未配置对话模型，无法抽取图谱'
      )
    )
  }
  const repo = new GraphRepository(options.drizzleDb)
  let embedder: { embedQuery?: (text: string) => Promise<number[] | null>; modelId?: string } | null =
    null
  try {
    const { EmbeddingAdapter } = await import('@baishou/ai')
    const { resolveMobileEmbeddingForHydration } = await import('./mobile-raw-data-source.runtime')
    const emb = await resolveMobileEmbeddingForHydration(options.settingsManager)
    if (emb.embeddingProvider && emb.embeddingModelId) {
      const adapter = new EmbeddingAdapter(emb.embeddingProvider, emb.embeddingModelId)
      if (adapter.isConfigured) {
        embedder = {
          embedQuery: (text) => adapter.embedQuery(text),
          modelId: adapter.embeddingModelId
        }
      }
    }
  } catch {
    embedder = null
  }
  const graphSync = new GraphSyncService(graphManager, repo, embedder)
  const alignDeps = await resolveMobileGraphExtractAlignDeps(options)
  return new GraphLlmExtractionService(
    graphManager,
    freshness,
    repo,
    graphSync,
    options.pathService,
    options.fileSystem,
    createDefaultGraphExtractLlm(llmDeps),
    {
      embedQuery: alignDeps.embedQuery ?? embedder?.embedQuery,
      modelId: alignDeps.modelId ?? embedder?.modelId,
      isEmbeddingConfigured: alignDeps.isEmbeddingConfigured,
      isDiaryEmbedded: alignDeps.isDiaryEmbedded
    }
  )
}

export async function mobileSearchGraphNodes(
  drizzleDb: AppDatabase,
  vaultId: string,
  query: string
) {
  return new GraphRepository(drizzleDb).searchNodesByName(vaultId, query, { limit: 30 })
}

export async function mobileFindNodeByName(
  drizzleDb: AppDatabase,
  vaultId: string,
  query: string,
  nodeType?: string
) {
  const hit = await new GraphRepository(drizzleDb).findNodeByNameOrAlias(
    vaultId,
    query,
    nodeType
  )
  if (!hit) return null
  return {
    id: hit.id,
    name: hit.name,
    nodeType: hit.nodeType,
    summary: hit.summary ?? '',
    aliases: hit.aliases ?? []
  }
}

export async function mobileLoadGlobalGraph(
  drizzleDb: AppDatabase,
  vaultId: string,
  maxNodes = GRAPH_GLOBAL_MAX_NODES,
  monthRange?: { startMonth: string; endMonth: string }
) {
  return new GraphRepository(drizzleDb).getGlobalGraph({ vaultId, maxNodes, monthRange })
}

/** Aligns with desktop `graph:get-node`. */
export async function mobileGetNode(drizzleDb: AppDatabase, vaultId: string, id: string) {
  return new GraphRepository(drizzleDb).getNodeById(id, vaultId)
}

/** Aligns with desktop `graph:get-view` → `GraphRepository.traverse`. */
export async function mobileGetView(
  drizzleDb: AppDatabase,
  vaultId: string,
  opts: { centerNodeId: string; depth?: 1 | 2 | 3 }
) {
  const depth = opts.depth === 3 ? 3 : opts.depth === 1 ? 1 : 2
  return new GraphRepository(drizzleDb).traverse(vaultId, opts.centerNodeId, depth)
}

export async function mobileListPendingEdges(drizzleDb: AppDatabase, vaultId: string) {
  return new GraphRepository(drizzleDb).listPendingEdges(vaultId)
}

export async function mobileListPending(drizzleDb: AppDatabase, vaultId: string) {
  const repo = new GraphRepository(drizzleDb)
  const [nodes, edges] = await Promise.all([
    repo.listPendingNodes(vaultId),
    repo.listPendingEdges(vaultId)
  ])
  return { nodes, edges }
}

export async function mobileEstimateExtraction(options: {
  vaultName: string
  vaultId: string
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
}) {
  const pending = await mobileListPendingReextract(options)
  const vault = await options.pathService.getActiveVaultPath()
  const charCounts: number[] = []
  if (vault) {
    for (const item of pending) {
      try {
        const full = `${vault.replace(/[/\\]+$/, '')}/${item.filePath.replace(/^[/\\]+/, '')}`
        const text = await options.fileSystem.readFile(full, 'utf8')
        charCounts.push(typeof text === 'string' ? text.length : 0)
      } catch {
        charCounts.push(0)
      }
    }
  }
  return estimateExtractionCost(pending.length, { charCounts })
}

async function writeMobileNodeReview(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  nodeId: string
  reviewStatus: 'approved' | 'rejected'
  vaultDisplayName?: string
}) {
  const repo = new GraphRepository(options.drizzleDb)
  const node = await repo.getNodeById(options.nodeId)
  if (!node) {
    throw new Error(i18n.t('graph.node_not_found', '节点不存在'))
  }
  const now = Date.now()
  const { graphManager } = ensureMobileRawDataRuntime(options)

  if (options.reviewStatus === 'rejected') {
    const related = await repo.listEntityTimeline(node.vaultId, options.nodeId, {
      approvedOnly: false,
      limit: 500
    })
    for (const edge of related.edges) {
      if (edge.reviewStatus === 'rejected' || edge.deletedAt != null) continue
      await mobileSetEdgeReviewInner({
        ...options,
        edgeId: edge.id,
        reviewStatus: 'rejected',
        approvePendingEndpoints: false,
        skipSync: true
      })
    }
  }

  let props: Record<string, unknown> = {}
  try {
    props = JSON.parse(node.propsJson || '{}') as Record<string, unknown>
  } catch {
    props = {}
  }
  await graphManager.writeRecord(
    {
      id: node.id,
      schemaVersion: 1,
      vaultId: node.vaultId,
      vaultName: options.vaultDisplayName ?? node.vaultId,
      nodeType: node.nodeType,
      name: node.name,
      aliases: node.aliases,
      summary: node.summary,
      props,
      mentionCount: node.mentionCount,
      firstSeenAt: node.firstSeenAt ?? now,
      lastSeenAt: node.lastSeenAt ?? now,
      origin: node.origin as 'ai' | 'user',
      shardMonth: node.shardMonth || graphDiaryInstant(null, now).shardMonth,
      createdAt: node.createdAt,
      updatedAt: now,
      deletedAt: null,
      reviewStatus: options.reviewStatus
    },
    { collection: 'nodes' }
  )
}

/** Internal edge review without recursive node cascade sync. */
async function mobileSetEdgeReviewInner(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  edgeId: string
  reviewStatus: 'approved' | 'rejected'
  vaultDisplayName?: string
  approvePendingEndpoints?: boolean
  skipSync?: boolean
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}) {
  const repo = new GraphRepository(options.drizzleDb)
  const edge = await repo.getEdgeById(options.edgeId)
  if (!edge) {
    throw new Error(i18n.t('auto.apps.mobile.src.services.mobile.graph.service.L142', '边不存在'))
  }
  const now = Date.now()
  const { graphManager } = ensureMobileRawDataRuntime(options)
  let props: Record<string, unknown> = {}
  try {
    props = JSON.parse(edge.propsJson || '{}') as Record<string, unknown>
  } catch {
    props = {}
  }
  await graphManager.writeRecord(
    {
      id: edge.id,
      schemaVersion: 1,
      vaultId: edge.vaultId,
      vaultName: options.vaultDisplayName ?? edge.vaultId,
      fromId: edge.fromId,
      toId: edge.toId,
      edgeType: edge.edgeType,
      props,
      validFrom: edge.validFrom,
      validTo: edge.validTo,
      isCurrent: options.reviewStatus === 'rejected' ? false : edge.isCurrent,
      sourceKind: edge.sourceKind,
      sourceRef: edge.sourceRef,
      sourceExcerpt: edge.sourceExcerpt,
      sourceContentHash: edge.sourceContentHash,
      confidence: edge.confidence,
      origin: edge.origin as 'ai' | 'user',
      reviewStatus: options.reviewStatus,
      shardMonth: edge.shardMonth,
      createdAt: edge.createdAt,
      updatedAt: now,
      deletedAt: null
    },
    { collection: 'edges' }
  )

  if (options.reviewStatus === 'approved' && options.approvePendingEndpoints !== false) {
    for (const endpointId of [edge.fromId, edge.toId]) {
      const node = await repo.getNodeById(endpointId, edge.vaultId)
      if (node && node.reviewStatus === 'pending') {
        await writeMobileNodeReview({
          ...options,
          nodeId: endpointId,
          reviewStatus: 'approved'
        })
      }
    }
  }

  if (!options.skipSync) {
    await syncMobileGraphPendingIndex({
      drizzleDb: options.drizzleDb,
      embeddingProvider: options.embeddingProvider,
      embeddingModelId: options.embeddingModelId
    })
  }
}

export async function mobileSetNodeReview(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  nodeId: string
  reviewStatus: 'approved' | 'rejected'
  vaultDisplayName?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}) {
  await writeMobileNodeReview(options)
  await syncMobileGraphPendingIndex({
    drizzleDb: options.drizzleDb,
    embeddingProvider: options.embeddingProvider,
    embeddingModelId: options.embeddingModelId
  })
}

export async function mobileSetEdgeReview(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  edgeId: string
  reviewStatus: 'approved' | 'rejected'
  vaultDisplayName?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}) {
  await mobileSetEdgeReviewInner({
    ...options,
    approvePendingEndpoints: true
  })
}

export async function mobileSetReviewsBatch(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  vaultId: string
  reviewStatus: GraphSetReviewsBatchInput['reviewStatus']
  nodeIds?: string[]
  edgeIds?: string[]
  allPending?: boolean
  vaultDisplayName?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}): Promise<{ ok: true; nodeCount: number; edgeCount: number }> {
  if (!isGraphReviewStatus(options.reviewStatus)) {
    throw new Error(i18n.t('graph.invalid_review_status', '无效的审核状态'))
  }
  const repo = new GraphRepository(options.drizzleDb)
  const [pendingNodes, pendingEdges] = await Promise.all([
    repo.listPendingNodes(options.vaultId),
    repo.listPendingEdges(options.vaultId)
  ])
  const nodeIds = uniqueNonEmptyIds(
    options.allPending ? pendingNodes.map((node) => node.id) : options.nodeIds
  )
  const edgeIds = options.allPending
    ? uniqueNonEmptyIds(pendingEdges.map((edge) => edge.id))
    : options.reviewStatus === 'approved'
      ? expandApprovedGraphReviewEdgeIds({
          nodeIds,
          edgeIds: options.edgeIds,
          pendingEdges
        })
      : uniqueNonEmptyIds(options.edgeIds)

  for (const nodeId of nodeIds) {
    const node = await repo.getNodeById(nodeId)
    if (!node) continue
    await writeMobileNodeReview({
      ...options,
      nodeId,
      reviewStatus: options.reviewStatus
    })
  }
  for (const edgeId of edgeIds) {
    const edge = await repo.getEdgeById(edgeId)
    if (!edge) continue
    await mobileSetEdgeReviewInner({
      ...options,
      edgeId,
      reviewStatus: options.reviewStatus,
      approvePendingEndpoints: options.reviewStatus === 'approved',
      skipSync: true
    })
  }
  await syncMobileGraphPendingIndex({
    drizzleDb: options.drizzleDb,
    embeddingProvider: options.embeddingProvider,
    embeddingModelId: options.embeddingModelId
  })
  return { ok: true, nodeCount: nodeIds.length, edgeCount: edgeIds.length }
}

export async function mobileUpsertNode(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  vaultId: string
  vaultDisplayName: string
  id: string
  name: string
  nodeType: string
  aliases?: string[]
  summary?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}): Promise<GraphNodeWriteResult> {
  const repo = new GraphRepository(options.drizzleDb)
  const existing = await repo.getNodeById(options.id)
  if (!existing) {
    throw new Error(i18n.t('graph.node_not_found', '节点不存在'))
  }
  const name = options.name.trim()
  const sameName = graphSameNameExistingFromRow(
    await repo.findNodeByNameOrAlias(options.vaultId, name, existing.nodeType || options.nodeType),
    existing.id
  )
  if (sameName) {
    return { conflict: 'same-name' as const, existing: sameName }
  }
  const now = Date.now()
  const { graphManager } = ensureMobileRawDataRuntime(options)
  let props: Record<string, unknown> = {}
  try {
    props = JSON.parse(existing.propsJson || '{}') as Record<string, unknown>
  } catch {
    props = {}
  }
  await graphManager.writeRecord(
    {
      id: existing.id,
      schemaVersion: 1,
      vaultId: options.vaultId,
      vaultName: options.vaultDisplayName,
      nodeType: existing.nodeType || options.nodeType,
      name,
      aliases: options.aliases ?? existing.aliases,
      summary: options.summary ?? existing.summary,
      props,
      mentionCount: existing.mentionCount,
      firstSeenAt: existing.firstSeenAt ?? now,
      lastSeenAt: now,
      origin: 'user',
      shardMonth: existing.shardMonth || graphDiaryInstant(null, now).shardMonth,
      createdAt: existing.createdAt,
      updatedAt: now,
      deletedAt: null,
      reviewStatus: 'approved'
    },
    { collection: 'nodes' }
  )
  await syncMobileGraphPendingIndex({
    drizzleDb: options.drizzleDb,
    embeddingProvider: options.embeddingProvider,
    embeddingModelId: options.embeddingModelId
  })
  return { id: existing.id } satisfies GraphNodeWriteResult
}

export async function mobileCreateNode(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  vaultId: string
  vaultDisplayName: string
  name: string
  nodeType: string
  aliases?: string[]
  summary?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}): Promise<GraphNodeWriteResult> {
  const repo = new GraphRepository(options.drizzleDb)
  const name = options.name.trim()
  const nodeType = GRAPH_NODE_TYPES.includes(options.nodeType as never)
    ? options.nodeType
    : 'topic'
  if (nodeType === 'entry') {
    throw new Error('entry 节点必须基于日记路径，不能手建随机 id')
  }
  const sameName = graphSameNameExistingFromRow(
    await repo.findNodeByNameOrAlias(options.vaultId, name, nodeType)
  )
  if (sameName) {
    return { conflict: 'same-name', existing: sameName }
  }
  const now = Date.now()
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const id = graphNodeIdForEntity(options.vaultId, nodeType, name)
  await graphManager.writeRecord(
    {
      id,
      schemaVersion: 1,
      vaultId: options.vaultId,
      vaultName: options.vaultDisplayName,
      nodeType,
      name,
      aliases: options.aliases ?? [],
      summary: options.summary ?? '',
      props: {},
      mentionCount: 0,
      firstSeenAt: now,
      lastSeenAt: now,
      origin: 'user',
      shardMonth: graphDiaryInstant(null, now).shardMonth,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      reviewStatus: 'approved'
    },
    { collection: 'nodes' }
  )
  await syncMobileGraphPendingIndex({
    drizzleDb: options.drizzleDb,
    embeddingProvider: options.embeddingProvider,
    embeddingModelId: options.embeddingModelId
  })
  return { id }
}

export async function mobileUpsertEdge(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  vaultId: string
  vaultDisplayName: string
  fromId: string
  toId: string
  edgeType: string
  id?: string
  sourceRef?: string
  sourceExcerpt?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}) {
  const now = Date.now()
  const diary = graphDiaryInstant(options.sourceRef ?? null, now)
  const shardMonth = diary.shardMonth
  const edgeType = GRAPH_EDGE_TYPES.includes(options.edgeType as (typeof GRAPH_EDGE_TYPES)[number])
    ? options.edgeType
    : 'relates_to'
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const id =
    options.id ||
    graphEdgeId(options.vaultId, options.fromId, options.toId, edgeType, options.sourceRef ?? null)
  await graphManager.writeRecord(
    {
      id,
      schemaVersion: 1,
      vaultId: options.vaultId,
      vaultName: options.vaultDisplayName,
      fromId: options.fromId,
      toId: options.toId,
      edgeType,
      props: {},
      validFrom: diary.validFrom ?? now,
      validTo: null,
      isCurrent: true,
      sourceKind: 'manual',
      sourceRef: options.sourceRef ?? null,
      sourceExcerpt: options.sourceExcerpt ?? '',
      sourceContentHash: null,
      confidence: 100,
      origin: 'user',
      reviewStatus: 'approved',
      shardMonth,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    },
    { collection: 'edges' }
  )
  await syncMobileGraphPendingIndex({
    drizzleDb: options.drizzleDb,
    embeddingProvider: options.embeddingProvider,
    embeddingModelId: options.embeddingModelId
  })
  return { id }
}

export async function mobileSoftDeleteGraph(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  kind: 'node' | 'edge'
  id: string
  vaultId?: string
}) {
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const repo = new GraphRepository(options.drizzleDb)
  await applyDiaryGraphSurgicalDelete({
    kind: options.kind,
    id: options.id,
    vaultId: options.vaultId,
    manager: graphManager,
    repo
  })
}

export async function mobileMergeGraphNodes(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  vaultId: string
  vaultName: string
  survivorId: string
  loserId: string
  reason?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}): Promise<{ survivorId: string; loserId: string }> {
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const repo = new GraphRepository(options.drizzleDb)
  const result = await mergeDiaryGraphNodes({
    vaultId: options.vaultId,
    vaultName: options.vaultName,
    survivorId: options.survivorId,
    loserId: options.loserId,
    reason: options.reason,
    manager: graphManager,
    repo
  })
  await syncDiaryGraphMergeIntoIndex({
    loserId: result.loserId,
    syncPendingIndex: (opts) =>
      syncMobileGraphPendingIndex({
        drizzleDb: options.drizzleDb,
        embeddingProvider: options.embeddingProvider,
        embeddingModelId: options.embeddingModelId,
        absentSweep: opts?.absentSweep
      }),
    softDeleteNode: (id) => repo.softDeleteNode(id)
  })
  return result
}

export async function mobileMergeGraphNodeGroup(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  vaultId: string
  vaultName: string
  survivorId: string
  loserIds: string[]
  reason?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}): Promise<{ survivorId: string; loserIds: string[] }> {
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const repo = new GraphRepository(options.drizzleDb)
  const result = await mergeDiaryGraphNodeGroup({
    vaultId: options.vaultId,
    vaultName: options.vaultName,
    survivorId: options.survivorId,
    loserIds: options.loserIds,
    reason: options.reason,
    manager: graphManager,
    repo
  })
  await syncDiaryGraphMergeGroupIntoIndex({
    loserIds: result.loserIds,
    syncPendingIndex: (opts) =>
      syncMobileGraphPendingIndex({
        drizzleDb: options.drizzleDb,
        embeddingProvider: options.embeddingProvider,
        embeddingModelId: options.embeddingModelId,
        absentSweep: opts?.absentSweep
      }),
    softDeleteNode: (id) => repo.softDeleteNode(id)
  })
  return result
}

export function createMobileGraphRag(drizzleDb: AppDatabase): GraphRagService {
  return new GraphRagService(new GraphRepository(drizzleDb))
}

export type { GraphRawManager }
