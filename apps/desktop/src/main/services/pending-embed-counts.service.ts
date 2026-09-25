import {
  buildPendingEmbedCounts,
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

/** 清缓存并通知渲染进程重拉「未整理」篇数（删除向量、整理完成等） */
export function notifyPendingEmbedCountsChanged(extra?: {
  diaryId?: number
  vaultId?: string
}): void {
  cache.invalidate()
  void import('electron')
    .then(({ BrowserWindow }) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('diary:sync-event', {
          type: 'embed-pending-changed',
          ...extra
        })
      }
    })
    .catch(() => {
      // 非 Electron 环境不广播
    })
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

async function countPendingGraphExtract(): Promise<number> {
  try {
    const { getDerivedFreshness } = await import('./raw-data-source.runtime')
    return (await getDerivedFreshness().listPendingReextract()).length
  } catch {
    return 0
  }
}

async function countPendingGraphDisambiguate(vaultId: string): Promise<number> {
  if (!connectionManager.isConnected()) return 0
  try {
    const { collectSuspectSignals, readSuspectReason, toSuspectScanEdge, toSuspectScanNode } =
      await import('@baishou/core-desktop')
    const repo = new GraphRepository(connectionManager.getDb())
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

export async function getOrganizePendingSnapshot(): Promise<
  PendingEmbedCounts & { graphExtract: number; graphDisambiguate: number }
> {
  const embed = await getPendingEmbedCountsForActiveVault()
  const vaultId = resolveActiveVaultId()
  const graphExtract = vaultId ? await countPendingGraphExtract() : 0
  const graphDisambiguate = vaultId ? await countPendingGraphDisambiguate(vaultId) : 0
  return { ...embed, graphExtract, graphDisambiguate }
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
    const [diaries, memories] = await Promise.all([
      countUnindexedDiariesForActiveVault(),
      countPendingMemories(vaultId)
    ])
    return buildPendingEmbedCounts({
      unindexedDiaryCount: diaries,
      missingMemoryCount: memories,
      missingGraphNodeCount: graphNodes
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
