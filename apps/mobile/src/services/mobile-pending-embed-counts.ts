import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  buildPendingEmbedCounts,
  createPendingEmbedCountCache,
  EMPTY_PENDING_EMBED_COUNTS,
  type PendingEmbedCounts
} from '@baishou/shared'
import { MemorySyncService } from '@baishou/core-mobile'
import { GraphRepository } from '@baishou/database'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import { hasPendingCountSource } from './mobile-pending-embed-ready.util'
import { resolveVaultScope, type MobileRagServiceDeps } from './mobile-rag-core.helpers'
import { getMobileMemoryRawManager } from './mobile-raw-data-source.runtime'
import { countUnindexedDiariesForActiveVault } from './mobile-unindexed-diary-count'

export type OrganizePendingSnapshot = PendingEmbedCounts & {
  graphExtract: number
  graphDisambiguate: number
}

const ORGANIZE_PENDING_SNAPSHOT_KEY = 'baishou.memory.organizePendingSnapshot.v1'
const cache = createPendingEmbedCountCache()
const changeListeners = new Set<() => void>()
let lastOrganizeSnapshot: OrganizePendingSnapshot | null = null

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

export function peekOrganizePendingSnapshot(): OrganizePendingSnapshot | null {
  return lastOrganizeSnapshot
}

function isOrganizePendingSnapshot(value: unknown): value is OrganizePendingSnapshot {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.total === 'number' && typeof row.graphExtract === 'number'
}

function rememberOrganizePendingSnapshot(snapshot: OrganizePendingSnapshot): void {
  lastOrganizeSnapshot = snapshot
  void AsyncStorage.setItem(ORGANIZE_PENDING_SNAPSHOT_KEY, JSON.stringify(snapshot)).catch(() => {
    // 本地缓存失败不影响计数
  })
}

export async function hydrateOrganizePendingSnapshot(): Promise<OrganizePendingSnapshot | null> {
  if (lastOrganizeSnapshot) return lastOrganizeSnapshot
  try {
    const raw = await AsyncStorage.getItem(ORGANIZE_PENDING_SNAPSHOT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isOrganizePendingSnapshot(parsed)) return null
    lastOrganizeSnapshot = parsed
    return parsed
  } catch {
    return null
  }
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

async function countPendingGraphExtract(input: {
  vaultId: string
  vaultName: string
}): Promise<number> {
  try {
    const runtime = agentDbRuntimeRef.current
    if (!runtime?.pathService) return 0
    const { mobileListPendingReextract } = await import('./mobile-graph-extract')
    const { ShadowIndexRepository, alignShadowJournalVaultId, shadowConnectionManager } =
      await import('@baishou/database')
    const { createMobileFileSystem } = await import('./create-mobile-file-system')
    const shadowDb = shadowConnectionManager.getDb()
    await alignShadowJournalVaultId(shadowDb, { id: input.vaultId, name: input.vaultName })
    const pending = await mobileListPendingReextract({
      vaultName: input.vaultName,
      vaultId: input.vaultId,
      shadowRepo: new ShadowIndexRepository(shadowDb, input.vaultId),
      pathService: runtime.pathService,
      fileSystem: createMobileFileSystem()
    })
    return pending.length
  } catch {
    return 0
  }
}

/** 整理进度条用：嵌入待办 + 抽图待办。阶段数组顺序由 shared 决定，这里只提供字段。 */
export async function getOrganizePendingSnapshot(
  deps: MobileRagServiceDeps
): Promise<OrganizePendingSnapshot> {
  const embedPromise = getPendingEmbedCounts(deps)
  const extractPromise = (async () => {
    const vaultScope = await resolveVaultScope(deps)
    const vaultId = await vaultScope.resolveActiveVaultId()
    const vaultName = (await vaultScope.resolveActiveVaultName()) || 'Personal'
    return vaultId ? countPendingGraphExtract({ vaultId, vaultName }) : 0
  })()
  const [embed, graphExtract] = await Promise.all([embedPromise, extractPromise])
  const snapshot = { ...embed, graphExtract, graphDisambiguate: 0 }
  rememberOrganizePendingSnapshot(snapshot)
  return snapshot
}
