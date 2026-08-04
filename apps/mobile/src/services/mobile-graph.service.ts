import {
  GraphLlmExtractionService,
  GraphSyncService,
  GraphRagService,
  bindPendingReextractCollaborators,
  createDefaultGraphExtractLlm,
  estimateExtractionCost,
  type GraphRawManager,
  type IFileSystem,
  type IStoragePathService
} from '@baishou/core-mobile'
import {
  GRAPH_EDGE_TYPES,
  GraphRepository,
  type AppDatabase,
  type ShadowIndexRepository
} from '@baishou/database'
import { AIProviderRegistry, type IAIProvider } from '@baishou/ai'
import type { SettingsManagerService } from '@baishou/core-mobile'
import {
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  getUserProfileFromSettings,
  resolveGlobalGraphModelIds,
  resolveGraphExtractSelfName,
  type GlobalModelsConfig
} from '@baishou/shared'
import i18n from 'i18next'
import {
  ensureMobileRawDataRuntime,
  syncMobileGraphPendingIndex
} from './mobile-raw-data-source.runtime'

let boundVault: string | null = null

export function ensureMobileGraphFreshnessBound(options: {
  vaultName: string
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
      getVaultName: () => options.vaultName
    })
    boundVault = options.vaultName
  }
  return freshness
}

export function wireMobilePendingReextractHook(options: {
  vaultName: string
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
  const flag = await options.settingsManager.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)
  const profile = await getUserProfileFromSettings(options.settingsManager)
  const selfName = resolveGraphExtractSelfName(flag === true, profile?.nickname)
  if (!selfName) {
    throw new Error(GRAPH_SELF_NAME_REQUIRED_ERROR)
  }
  const repo = new GraphRepository(options.drizzleDb)
  const graphSync = new GraphSyncService(graphManager, repo, null)
  const service = new GraphLlmExtractionService(
    graphManager,
    freshness,
    repo,
    graphSync,
    options.pathService,
    options.fileSystem,
    createDefaultGraphExtractLlm(llmDeps)
  )
  return service.extractDiaries({
    vaultId: options.vaultId,
    vaultName: options.vaultName,
    selfName,
    filePaths: options.filePaths,
    signal: options.signal,
    onProgress: options.onProgress
  })
}

export async function mobileSearchGraphNodes(
  drizzleDb: AppDatabase,
  vaultId: string,
  query: string
) {
  return new GraphRepository(drizzleDb).searchNodesByName(vaultId, query, { limit: 30 })
}

export async function mobileLoadGlobalGraph(
  drizzleDb: AppDatabase,
  vaultId: string,
  maxNodes = 120
) {
  return new GraphRepository(drizzleDb).getGlobalGraph({ vaultId, maxNodes })
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
      createdAt: node.createdAt,
      updatedAt: now,
      deletedAt: options.reviewStatus === 'rejected' ? now : node.deletedAt,
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
      deletedAt: options.reviewStatus === 'rejected' ? now : edge.deletedAt
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
}) {
  const repo = new GraphRepository(options.drizzleDb)
  const existing = await repo.getNodeById(options.id)
  if (!existing) {
    throw new Error(i18n.t('graph.node_not_found', '节点不存在'))
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
      name: options.name.trim(),
      aliases: options.aliases ?? existing.aliases,
      summary: options.summary ?? existing.summary,
      props,
      mentionCount: existing.mentionCount,
      firstSeenAt: existing.firstSeenAt ?? now,
      lastSeenAt: now,
      origin: 'user',
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
  return { id: existing.id }
}

function newGraphId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
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
  const d = new Date(now)
  const shardMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const edgeType = GRAPH_EDGE_TYPES.includes(options.edgeType as (typeof GRAPH_EDGE_TYPES)[number])
    ? options.edgeType
    : 'relates_to'
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const id = options.id || newGraphId('e')
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
      validFrom: now,
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
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}) {
  const { graphManager } = ensureMobileRawDataRuntime(options)
  await graphManager.tombstone(options.id, {
    collection: options.kind === 'node' ? 'nodes' : 'edges'
  })
  await syncMobileGraphPendingIndex({
    drizzleDb: options.drizzleDb,
    embeddingProvider: options.embeddingProvider,
    embeddingModelId: options.embeddingModelId
  })
}

export function createMobileGraphRag(drizzleDb: AppDatabase): GraphRagService {
  return new GraphRagService(new GraphRepository(drizzleDb))
}

export type { GraphRawManager }
