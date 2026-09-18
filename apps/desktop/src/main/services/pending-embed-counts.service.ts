import {
  buildPendingEmbedCounts,
  countPendingFromUnembeddedList,
  createPendingEmbedCountCache,
  EMPTY_PENDING_EMBED_COUNTS,
  logger,
  type PendingEmbedCounts
} from '@baishou/shared'
import { GraphRepository, connectionManager } from '@baishou/database-desktop'
import { MemorySyncService } from '@baishou/core-desktop'
import { countUnindexedDiariesForActiveVault } from './diary-embedding.util'
import { vaultService, resolveActiveVaultId } from '../ipc/vault.ipc'
import { getMemoryRawManager } from './raw-data-source.runtime'
import { DesktopEmbeddingStorage } from '../ipc/rag.storage'

const cache = createPendingEmbedCountCache()

export function invalidatePendingEmbedCountsCache(): void {
  cache.invalidate()
}

async function countPendingMemories(vaultId: string): Promise<number> {
  try {
    const memoryManager = getMemoryRawManager()
    const storage = new DesktopEmbeddingStorage()
    const sync = new MemorySyncService(memoryManager, {
      embedText: async () => {
        throw new Error('countPendingMemories: embedText should not run')
      },
      listLedgerBySource: (sourceType, options) => storage.listLedgerBySource(sourceType, options)
    })
    return await sync.countPendingFromShards({ vaultId })
  } catch {
    return 0
  }
}

async function countPendingGraphNodes(vaultId: string): Promise<number> {
  if (!connectionManager.isConnected()) {
    throw new Error('graph-db-not-ready')
  }
  const repo = new GraphRepository(connectionManager.getDb())
  const counted = await repo.countUnembeddedLiveNodes(vaultId)
  if (counted > 0) return counted
  const listed = await repo.listUnembeddedLiveNodes(vaultId)
  return listed.length
}

async function countPendingKnowledgeSources(vaultId: string): Promise<number> {
  try {
    const { KnowledgeRepository, knowledgeConnectionManager } =
      await import('@baishou/database-desktop')
    if (!knowledgeConnectionManager.isConnected?.()) return 0
    const repo = new KnowledgeRepository(knowledgeConnectionManager.getDb())
    return await repo.countPendingEmbedSources(vaultId)
  } catch {
    return 0
  }
}

async function countPendingGraphExtract(vaultId: string): Promise<number> {
  let diary = 0
  try {
    const { getDerivedFreshness } = await import('./raw-data-source.runtime')
    diary = (await getDerivedFreshness().listPendingReextract()).length
  } catch {
    diary = 0
  }
  let knowledge = 0
  try {
    const { KnowledgeRepository, knowledgeConnectionManager } =
      await import('@baishou/database-desktop')
    if (!knowledgeConnectionManager.isConnected?.()) return diary
    const repo = new KnowledgeRepository(knowledgeConnectionManager.getDb())
    knowledge = await repo.countIngestJobs({
      vaultId,
      stages: ['graph'],
      claimableOnly: true
    })
  } catch {
    knowledge = 0
  }
  return diary + knowledge
}

export async function getOrganizePendingSnapshot(): Promise<
  PendingEmbedCounts & { graphExtract: number }
> {
  const embed = await getPendingEmbedCountsForActiveVault()
  const vaultId = resolveActiveVaultId()
  const graphExtract = vaultId ? await countPendingGraphExtract(vaultId) : 0
  return { ...embed, graphExtract }
}

async function countPendingNotebookGraphNodes(vaultId: string): Promise<number> {
  try {
    const { NotebookGraphRepository, knowledgeConnectionManager } =
      await import('@baishou/database-desktop')
    if (!knowledgeConnectionManager.isConnected?.()) return 0
    const repo = new NotebookGraphRepository(knowledgeConnectionManager.getDb())
    return await countPendingFromUnembeddedList(() => repo.listUnembeddedLiveNodes(vaultId))
  } catch {
    return 0
  }
}

export async function getPendingEmbedCountsForActiveVault(): Promise<PendingEmbedCounts> {
  const vault = vaultService.getActiveVault()
  if (!vault) return EMPTY_PENDING_EMBED_COUNTS
  const vaultId = resolveActiveVaultId()

  const load = async (requireGraph: boolean) => {
    let graphNodes = 0
    if (requireGraph) {
      graphNodes = await countPendingGraphNodes(vaultId)
    } else {
      try {
        graphNodes = await countPendingGraphNodes(vaultId)
      } catch (error) {
        logger.warn('[PendingEmbedCounts] graph node count failed', error as Error)
      }
    }
    const [diaries, memories, knowledgeSources, notebookGraphNodes] = await Promise.all([
      countUnindexedDiariesForActiveVault(),
      countPendingMemories(vaultId),
      countPendingKnowledgeSources(vaultId),
      countPendingNotebookGraphNodes(vaultId)
    ])
    return buildPendingEmbedCounts({
      unindexedDiaryCount: diaries,
      missingMemoryCount: memories,
      missingGraphNodeCount: graphNodes,
      missingKnowledgeSourceCount: knowledgeSources,
      missingNotebookGraphNodeCount: notebookGraphNodes
    })
  }

  if (connectionManager.isConnected()) {
    try {
      return await cache.get(() => load(true))
    } catch (error) {
      logger.warn('[PendingEmbedCounts] graph node count failed', error as Error)
    }
  }
  return load(false)
}
