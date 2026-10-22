import {
  GraphLlmExtractionService,
  GraphSyncService,
  createDefaultGraphExtractLlm
} from '@baishou/core-desktop'
import { connectionManager, UserProfileRepository } from '@baishou/database-desktop'
import {
  GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR,
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  buildGraphExtractEnqueueItems,
  resolveGlobalGraphModelIds,
  resolveReasoningEffortForSlot,
  resolveGraphExtractSelfName,
  type GlobalModelsConfig
} from '@baishou/shared'
import { fileSystem, pathService } from './vault.ipc'
import { ensureRawDataRuntime, getDerivedFreshness } from '../services/raw-data-source.runtime'
import { getActiveProvider } from './agent-helpers'
import { GraphExtractQueueService } from '../services/graph-extract-queue.service'
import { resolveDesktopGraphExtractAlignDeps } from '../services/graph-extract-embed-gate'
import { requireGraphRepo, requireVaultId } from './graph-ipc.context'

export async function resolveExtractLlm() {
  const { settingsManager } = await import('./settings.ipc')
  const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
  const { providerId, modelId } = resolveGlobalGraphModelIds(globalModels)
  if (!providerId || !modelId) throw new Error('graph-extract-not-configured')
  const provider = await getActiveProvider(providerId)
  return createDefaultGraphExtractLlm({
    provider,
    modelId,
    reasoningEffort: resolveReasoningEffortForSlot(globalModels?.reasoningEffortBySlot, 'graph')
  })
}

export async function resolveGraphQueryEmbedder(): Promise<{
  embedQuery: (text: string) => Promise<number[] | null>
  modelId?: string
} | null> {
  try {
    const { resolveEmbeddingSystemModels } = await import('./agent-helpers')
    const { EmbeddingAdapter } = await import('@baishou/ai')
    const { createSqlExecutorFromDrizzleDb, SqliteHybridSearchRepository } =
      await import('@baishou/database-desktop')
    const { embeddingProvider, embeddingModelId } = await resolveEmbeddingSystemModels()
    if (!embeddingProvider || !embeddingModelId || !connectionManager.isConnected()) return null
    const hsRepo = new SqliteHybridSearchRepository(
      createSqlExecutorFromDrizzleDb(connectionManager.getDb())
    )
    const adapter = new EmbeddingAdapter(embeddingProvider, embeddingModelId, hsRepo)
    if (!adapter.isConfigured) return null
    return {
      embedQuery: (text) => adapter.embedQuery(text),
      modelId: adapter.embeddingModelId
    }
  } catch {
    return null
  }
}

const EXTRACT_RUNTIME_CACHE_TTL_MS = 3_000
let cachedServiceEntry: {
  vaultId: string
  expiresAt: number
  promise: Promise<GraphLlmExtractionService>
} | null = null
let cachedSelfNameEntry: {
  vaultId: string
  expiresAt: number
  promise: Promise<string>
} | null = null

export async function buildExtractionService(): Promise<GraphLlmExtractionService> {
  const vaultId = requireVaultId()
  const now = Date.now()
  if (
    cachedServiceEntry &&
    cachedServiceEntry.vaultId === vaultId &&
    now < cachedServiceEntry.expiresAt
  ) {
    return cachedServiceEntry.promise
  }
  const promise = (async () => {
    const { graphManager, freshness } = ensureRawDataRuntime()
    const repo = requireGraphRepo()
    const llm = await resolveExtractLlm()
    const embedder = await resolveGraphQueryEmbedder()
    const alignDeps = await resolveDesktopGraphExtractAlignDeps(vaultId)
    const modelId = alignDeps.modelId ?? embedder?.modelId
    // 抽图提交（syncPendingIndex）阶段仅透传 modelId 以便落库对齐阶段已算出的节点向量，
    // 不在同步循环内逐条串行调用远程 Embedding，剩余未嵌入节点由后续 graph_node 阶段集中补齐。
    const graphSync = new GraphSyncService(graphManager, repo, modelId ? { modelId } : null)
    return new GraphLlmExtractionService(
      graphManager,
      freshness,
      repo,
      graphSync,
      pathService,
      fileSystem,
      llm,
      {
        embedQuery: alignDeps.embedQuery ?? embedder?.embedQuery,
        modelId,
        isEmbeddingConfigured: alignDeps.isEmbeddingConfigured,
        isDiaryEmbedded: alignDeps.isDiaryEmbedded
      }
    )
  })()
  cachedServiceEntry = { vaultId, expiresAt: now + EXTRACT_RUNTIME_CACHE_TTL_MS, promise }
  promise.catch(() => {
    if (cachedServiceEntry?.promise === promise) cachedServiceEntry = null
  })
  return promise
}

export async function resolveExtractSelfName(): Promise<string> {
  const vaultId = requireVaultId()
  const now = Date.now()
  if (
    cachedSelfNameEntry &&
    cachedSelfNameEntry.vaultId === vaultId &&
    now < cachedSelfNameEntry.expiresAt
  ) {
    return cachedSelfNameEntry.promise
  }
  const promise = (async () => {
    const { settingsManager } = await import('./settings.ipc')
    const flag = await settingsManager.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)
    if (!connectionManager.isConnected()) {
      throw new Error(GRAPH_SELF_NAME_REQUIRED_ERROR)
    }
    const profile = await new UserProfileRepository(connectionManager.getDb()).getProfile()
    const selfName = resolveGraphExtractSelfName(flag === true, profile?.nickname)
    if (!selfName) {
      throw new Error(GRAPH_SELF_NAME_REQUIRED_ERROR)
    }
    return selfName
  })()
  cachedSelfNameEntry = { vaultId, expiresAt: now + EXTRACT_RUNTIME_CACHE_TTL_MS, promise }
  promise.catch(() => {
    if (cachedSelfNameEntry?.promise === promise) cachedSelfNameEntry = null
  })
  return promise
}

export async function enqueueGraphExtract(
  extractQueue: GraphExtractQueueService,
  opts?: { filePaths?: string[]; concurrency?: number }
): Promise<{
  queued: number
  totalPending: number
  skippedNotEmbedded: string[]
  blockedPendingEmbed?: number
}> {
  await resolveExtractSelfName()
  if (opts?.concurrency != null) {
    extractQueue.setConcurrency(opts.concurrency)
  }
  const vaultId = requireVaultId()
  const alignDeps = await resolveDesktopGraphExtractAlignDeps(vaultId)
  if (!(await alignDeps.isEmbeddingConfigured?.())) {
    throw new Error(GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR)
  }
  const pending = await getDerivedFreshness().listPendingReextract()
  const wanted = opts?.filePaths?.length ? opts.filePaths : pending.map((p) => p.filePath)
  const { items, skippedNotEmbedded } = await buildGraphExtractEnqueueItems({
    wanted,
    pending,
    isDiaryEmbedded: alignDeps.isDiaryEmbedded
  })
  if (items.length === 0 && skippedNotEmbedded.length > 0 && !opts?.filePaths?.length) {
    const { getPendingEmbedCountsForActiveVault } =
      await import('../services/pending-embed-counts.service')
    const pendingCounts = await getPendingEmbedCountsForActiveVault()
    if (pendingCounts.diaries > 0) {
      return {
        queued: 0,
        totalPending: 0,
        skippedNotEmbedded,
        blockedPendingEmbed: pendingCounts.diaries
      }
    }
  }
  const queued = extractQueue.enqueue(items)
  return { queued, totalPending: items.length, skippedNotEmbedded }
}
