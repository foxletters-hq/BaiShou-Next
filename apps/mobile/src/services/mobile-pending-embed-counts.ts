import {
  buildPendingEmbedCounts,
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
const changeListeners = new Set<() => void>()

export function invalidateMobilePendingEmbedCountsCache(): void {
  cache.invalidate()
}

export function subscribeMobilePendingEmbedCountsChanged(listener: () => void): () => void {
  changeListeners.add(listener)
  return () => {
    changeListeners.delete(listener)
  }
}

export function notifyMobilePendingEmbedCountsChanged(): void {
  cache.invalidate()
  for (const listener of changeListeners) listener()
}

export async function getPendingEmbedCounts(
  deps: MobileRagServiceDeps
): Promise<PendingEmbedCounts> {
  return cache.get(async () => {
    const vaultScope = await resolveVaultScope(deps)
    const vaultId = await vaultScope.resolveActiveVaultId()
    if (!vaultId) return EMPTY_PENDING_EMBED_COUNTS

    const [diaries, memories, graphNodes] = await Promise.all([
      countUnindexedDiariesForActiveVault(deps),
      countPendingMemories(deps, vaultId),
      countPendingGraphNodes(vaultId)
    ])
    return buildPendingEmbedCounts({
      unindexedDiaryCount: diaries,
      missingMemoryCount: memories,
      missingGraphNodeCount: graphNodes
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

async function countPendingGraphExtract(): Promise<number> {
  try {
    return (await getMobileDerivedFreshness()?.listPendingReextract())?.length ?? 0
  } catch {
    return 0
  }
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
  const graphExtract = vaultId ? await countPendingGraphExtract() : 0
  const graphDisambiguate = vaultId ? await countPendingGraphDisambiguate(vaultId) : 0
  return { ...embed, graphExtract, graphDisambiguate }
}
