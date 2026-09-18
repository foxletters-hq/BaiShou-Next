import {
  buildPendingEmbedCounts,
  countPendingFromUnembeddedList,
  createPendingEmbedCountCache,
  EMPTY_PENDING_EMBED_COUNTS,
  type PendingEmbedCounts
} from '@baishou/shared'
import {
  collectSuspectSignals,
  MemorySyncService,
  readSuspectReason,
  toSuspectScanEdge,
  toSuspectScanNode
} from '@baishou/core-mobile'
import { GraphRepository } from '@baishou/database'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import { hasPendingCountSource } from './mobile-pending-embed-ready.util'
import { resolveVaultScope, type MobileRagServiceDeps } from './mobile-rag-core.helpers'
import {
  getMobileDerivedFreshness,
  getMobileMemoryRawManager
} from './mobile-raw-data-source.runtime'
import { countUnindexedDiariesForActiveVault } from './mobile-unindexed-diary-count'

export type OrganizePendingSnapshot = PendingEmbedCounts & {
  graphExtract: number
  graphDisambiguate: number
}

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
    if (!hasPendingCountSource(memoryManager)) {
      // 本函数与 PendingEmbedCounts 都只能表达数字，无法单独标「数不出来」
      return 0
    }
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

async function countPendingGraphExtract(vaultId: string): Promise<number> {
  let diary = 0
  try {
    diary = (await getMobileDerivedFreshness()?.listPendingReextract())?.length ?? 0
  } catch {
    diary = 0
  }
  let knowledge = 0
  try {
    const { expoKnowledgeConnectionManager, KnowledgeRepository } =
      await import('@baishou/database/expo')
    if (!expoKnowledgeConnectionManager.isConnected()) return diary
    const repo = new KnowledgeRepository(expoKnowledgeConnectionManager.getDb())
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

async function countPendingGraphDisambiguate(vaultId: string): Promise<number> {
  try {
    const drizzleDb = agentDbRuntimeRef.current?.drizzleDb
    if (!drizzleDb) return 0
    const repo = new GraphRepository(drizzleDb)
    const scan = await repo.listLiveScanGraph(vaultId)
    const nodes = scan.nodes.map(toSuspectScanNode)
    const edges = scan.edges.map(toSuspectScanEdge)
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    return collectSuspectSignals(nodes, edges).filter((hit) => {
      const node = nodeById.get(hit.nodeId)
      return Boolean(node && !readSuspectReason(node.props))
    }).length
  } catch {
    return 0
  }
}

/** 整理进度条用：嵌入待办 + 抽图 / 可疑扫描待办。阶段数组顺序由 shared 决定，这里只提供字段。 */
export async function getOrganizePendingSnapshot(
  deps: MobileRagServiceDeps
): Promise<OrganizePendingSnapshot> {
  const embed = await getPendingEmbedCounts(deps)
  const vaultScope = await resolveVaultScope(deps)
  const vaultId = await vaultScope.resolveActiveVaultId()
  const graphExtract = vaultId ? await countPendingGraphExtract(vaultId) : 0
  const graphDisambiguate = vaultId ? await countPendingGraphDisambiguate(vaultId) : 0
  return { ...embed, graphExtract, graphDisambiguate }
}
