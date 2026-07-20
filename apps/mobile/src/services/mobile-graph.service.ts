import {
  GraphLlmExtractionService,
  GraphSyncService,
  GraphRagService,
  bindPendingReextractCollaborators,
  createDefaultGraphExtractLlm,
  type GraphRawManager,
  type IFileSystem,
  type IStoragePathService
} from '@baishou/core-mobile'
import { GraphRepository, type AppDatabase, type ShadowIndexRepository } from '@baishou/database'
import { AIProviderRegistry, type IAIProvider } from '@baishou/ai'
import type { SettingsManagerService } from '@baishou/core-mobile'
import { resolveGlobalGraphModelIds, type GlobalModelsConfig } from '@baishou/shared'
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
  vaultName: string
  drizzleDb: AppDatabase
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
  settingsManager: SettingsManagerService
  filePaths?: string[]
}) {
  const freshness = ensureMobileGraphFreshnessBound(options)
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const llmDeps = await resolveChatLlm(options.settingsManager)
  if (!llmDeps) throw new Error('未配置对话模型，无法抽取图谱')
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
    vaultName: options.vaultName,
    filePaths: options.filePaths
  })
}

export async function mobileSearchGraphNodes(
  drizzleDb: AppDatabase,
  vaultName: string,
  query: string
) {
  return new GraphRepository(drizzleDb).searchNodesByName(vaultName, query, { limit: 30 })
}

export async function mobileLoadGlobalGraph(
  drizzleDb: AppDatabase,
  vaultName: string,
  maxNodes = 120
) {
  return new GraphRepository(drizzleDb).getGlobalGraph({ vaultName, maxNodes })
}

export async function mobileListPendingEdges(drizzleDb: AppDatabase, vaultName: string) {
  return new GraphRepository(drizzleDb).listPendingEdges(vaultName)
}

export async function mobileSetEdgeReview(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  edgeId: string
  reviewStatus: 'approved' | 'rejected'
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}) {
  const repo = new GraphRepository(options.drizzleDb)
  const edge = await repo.getEdgeById(options.edgeId)
  if (!edge) throw new Error('边不存在')
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
      vaultName: edge.vaultName,
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
