import { GraphRagService, type SettingsManagerService } from '@baishou/core-mobile'
import { GraphRepository, type AppDatabase } from '@baishou/database'
import {
  GRAPH_GLOBAL_MAX_NODES,
  GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR,
  resolveGraphSearchMode,
  type GraphSearchMode
} from '@baishou/shared'
import { resolveMobileEmbeddingForHydration } from './mobile-raw-data-source.runtime'
import { pickBareGraphNameHit } from './graph-name-candidates.util'

export async function mobileSearchGraphNodes(
  drizzleDb: AppDatabase,
  vaultId: string,
  query: string,
  opts?: {
    mode?: GraphSearchMode
    limit?: number
    settingsManager?: SettingsManagerService
  }
) {
  const repo = new GraphRepository(drizzleDb)
  const limit = opts?.limit ?? 30
  const mode = resolveGraphSearchMode(opts?.mode)
  if (mode !== 'semantic') {
    return repo.searchNodesByName(vaultId, query, { limit })
  }
  if (!opts?.settingsManager) {
    throw new Error(GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR)
  }
  const { EmbeddingAdapter } = await import('@baishou/ai')
  const emb = await resolveMobileEmbeddingForHydration(opts.settingsManager)
  if (!emb.embeddingProvider || !emb.embeddingModelId) {
    throw new Error(GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR)
  }
  const adapter = new EmbeddingAdapter(emb.embeddingProvider, emb.embeddingModelId)
  if (!adapter.isConfigured) {
    throw new Error(GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR)
  }
  const vector = await adapter.embedQuery(query)
  if (!vector?.length) return []
  const hits = await repo.searchNodesByVector(vaultId, vector, limit, {
    modelId: adapter.embeddingModelId
  })
  return hits
    .filter((row) => row.reviewStatus !== 'rejected')
    .map(({ distance: _distance, ...row }) => row)
}

export async function mobileFindNodesByName(
  drizzleDb: AppDatabase,
  vaultId: string,
  query: string,
  nodeType?: string
) {
  return new GraphRepository(drizzleDb).findNodesByNameOrAlias(vaultId, query, nodeType)
}

export async function mobileFindNodeByName(
  drizzleDb: AppDatabase,
  vaultId: string,
  query: string,
  nodeType?: string
) {
  const hits = await new GraphRepository(drizzleDb).findNodesByNameOrAlias(vaultId, query, nodeType)
  const picked = pickBareGraphNameHit(hits)
  if (!picked.hit) return null
  return {
    id: picked.hit.id,
    name: picked.hit.name,
    nodeType: picked.hit.nodeType,
    summary: picked.hit.summary ?? '',
    aliases: picked.hit.aliases ?? [],
    discriminator: picked.hit.discriminator ?? '',
    ambiguous: picked.ambiguous
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
  return new GraphRepository(drizzleDb).listPendingGraph(vaultId)
}

export async function mobileListSuspectNodes(drizzleDb: AppDatabase, vaultId: string) {
  return new GraphRepository(drizzleDb).listSuspectNodes(vaultId)
}

export async function mobileListSimilarPairs(drizzleDb: AppDatabase, vaultId: string) {
  return new GraphRepository(drizzleDb).listSimilarPendingPairs(vaultId)
}

export function createMobileGraphRag(drizzleDb: AppDatabase): GraphRagService {
  return new GraphRagService(new GraphRepository(drizzleDb))
}
