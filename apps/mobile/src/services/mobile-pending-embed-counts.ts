import {
  buildPendingEmbedCounts,
  countPendingFromUnembeddedList,
  createPendingEmbedCountCache,
  EMPTY_PENDING_EMBED_COUNTS,
  type PendingEmbedCounts
} from '@baishou/shared'
import { MemorySyncService } from '@baishou/core-mobile'
import { GraphRepository } from '@baishou/database'
import { countUnindexedDiariesForActiveVault } from './mobile-unindexed-diary-count'
import { resolveVaultScope, type MobileRagServiceDeps } from './mobile-rag-core.helpers'
import { getMobileMemoryRawManager } from './mobile-raw-data-source.runtime'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'

const cache = createPendingEmbedCountCache()

export function invalidateMobilePendingEmbedCountsCache(): void {
  cache.invalidate()
}

export async function getPendingEmbedCounts(
  deps: MobileRagServiceDeps
): Promise<PendingEmbedCounts> {
  return cache.get(async () => {
    const vaultScope = await resolveVaultScope(deps)
    const vaultId = await vaultScope.resolveActiveVaultId()
    if (!vaultId) return EMPTY_PENDING_EMBED_COUNTS

    const [diaries, memories, graphNodes, knowledgeSources, notebookGraphNodes] = await Promise.all(
      [
        countUnindexedDiariesForActiveVault(deps),
        countPendingMemories(deps, vaultId),
        countPendingGraphNodes(vaultId),
        countPendingKnowledgeSources(vaultId),
        countPendingNotebookGraphNodes(vaultId)
      ]
    )
    return buildPendingEmbedCounts({
      unindexedDiaryCount: diaries,
      missingMemoryCount: memories,
      missingGraphNodeCount: graphNodes,
      missingKnowledgeSourceCount: knowledgeSources,
      missingNotebookGraphNodeCount: notebookGraphNodes
    })
  })
}

async function countPendingMemories(deps: MobileRagServiceDeps, vaultId: string): Promise<number> {
  try {
    const memoryManager = getMobileMemoryRawManager()
    const sync = new MemorySyncService(memoryManager, {
      embedText: async () => {
        throw new Error('countPendingMemories: embedText should not run')
      },
      listLedgerBySource: (sourceType, options) =>
        deps.hsRepo.listLedgerBySource(sourceType, options)
    })
    return await sync.countPendingFromShards({ vaultId })
  } catch {
    return 0
  }
}

async function countPendingGraphNodes(vaultId: string): Promise<number> {
  try {
    const drizzleDb = agentDbRuntimeRef.current?.drizzleDb
    if (!drizzleDb) return 0
    const repo = new GraphRepository(drizzleDb)
    return await repo.countUnembeddedLiveNodes(vaultId)
  } catch {
    return 0
  }
}

async function countPendingKnowledgeSources(vaultId: string): Promise<number> {
  try {
    const { expoKnowledgeConnectionManager, KnowledgeRepository } =
      await import('@baishou/database/expo')
    if (!expoKnowledgeConnectionManager.isConnected()) return 0
    const repo = new KnowledgeRepository(expoKnowledgeConnectionManager.getDb())
    return await repo.countPendingEmbedSources(vaultId)
  } catch {
    return 0
  }
}

async function countPendingNotebookGraphNodes(vaultId: string): Promise<number> {
  try {
    const { expoKnowledgeConnectionManager, NotebookGraphRepository } =
      await import('@baishou/database/expo')
    if (!expoKnowledgeConnectionManager.isConnected()) return 0
    const repo = new NotebookGraphRepository(expoKnowledgeConnectionManager.getDb())
    return await countPendingFromUnembeddedList(() => repo.listUnembeddedLiveNodes(vaultId))
  } catch {
    return 0
  }
}
