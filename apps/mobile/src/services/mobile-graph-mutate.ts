import {
  clearLifeGraphData,
  mergeDiaryGraphNodeGroup,
  mergeDiaryGraphNodes,
  applyDiaryGraphSurgicalDelete,
  syncDiaryGraphMergeGroupIntoIndex,
  syncDiaryGraphMergeIntoIndex,
  type IFileSystem,
  type IStoragePathService
} from '@baishou/core-mobile'
import {
  GRAPH_EDGE_TYPES,
  GRAPH_NODE_TYPES,
  GraphRepository,
  type AppDatabase,
  type ShadowIndexRepository
} from '@baishou/database'
import type { IAIProvider } from '@baishou/ai'
import {
  graphDiaryInstant,
  graphEdgeId,
  graphNodeIdForEntity,
  pickSameNameConflictFromHits,
  type GraphNodeWriteResult
} from '@baishou/shared'
import i18n from 'i18next'
import {
  ensureMobileRawDataRuntime,
  syncMobileGraphPendingIndex
} from './mobile-raw-data-source.runtime'
import { parseGraphNodePropsJson } from './graph-name-candidates.util'
import { ensureMobileGraphFreshnessBound } from './mobile-graph-extract'

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
}): Promise<GraphNodeWriteResult> {
  const repo = new GraphRepository(options.drizzleDb)
  const existing = await repo.getNodeById(options.id)
  if (!existing) {
    throw new Error(i18n.t('graph.node_not_found', '节点不存在'))
  }
  const name = options.name.trim()
  const sameName =
    name === existing.name
      ? null
      : pickSameNameConflictFromHits(
          await repo.findNodesByNameOrAlias(
            options.vaultId,
            name,
            existing.nodeType || options.nodeType
          ),
          existing.id,
          existing.discriminator ?? ''
        )
  if (sameName) {
    return { conflict: 'same-name' as const, existing: sameName }
  }
  const now = Date.now()
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const props = parseGraphNodePropsJson(existing.propsJson)
  await graphManager.writeRecord(
    {
      id: existing.id,
      schemaVersion: 1,
      vaultId: options.vaultId,
      vaultName: options.vaultDisplayName,
      nodeType: existing.nodeType || options.nodeType,
      name,
      discriminator: existing.discriminator ?? '',
      aliases: options.aliases ?? existing.aliases,
      summary: options.summary ?? existing.summary,
      props,
      mentionCount: existing.mentionCount,
      firstSeenAt: existing.firstSeenAt ?? now,
      lastSeenAt: now,
      origin: 'user',
      shardMonth: existing.shardMonth || graphDiaryInstant(null, now).shardMonth,
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
  return { id: existing.id } satisfies GraphNodeWriteResult
}

export async function mobileCreateNode(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  vaultId: string
  vaultDisplayName: string
  name: string
  nodeType: string
  aliases?: string[]
  summary?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}): Promise<GraphNodeWriteResult> {
  const repo = new GraphRepository(options.drizzleDb)
  const name = options.name.trim()
  const nodeType = GRAPH_NODE_TYPES.includes(options.nodeType as never) ? options.nodeType : 'topic'
  if (nodeType === 'entry') {
    throw new Error(
      i18n.t('graph.entry_node_requires_diary_path', 'entry 节点必须基于日记路径，不能手建随机 id')
    )
  }
  const sameName = pickSameNameConflictFromHits(
    await repo.findNodesByNameOrAlias(options.vaultId, name, nodeType),
    undefined,
    ''
  )
  if (sameName) {
    return { conflict: 'same-name', existing: sameName }
  }
  const now = Date.now()
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const id = graphNodeIdForEntity(options.vaultId, nodeType, name)
  await graphManager.writeRecord(
    {
      id,
      schemaVersion: 1,
      vaultId: options.vaultId,
      vaultName: options.vaultDisplayName,
      nodeType,
      name,
      discriminator: '',
      aliases: options.aliases ?? [],
      summary: options.summary ?? '',
      props: {},
      mentionCount: 0,
      firstSeenAt: now,
      lastSeenAt: now,
      origin: 'user',
      shardMonth: graphDiaryInstant(null, now).shardMonth,
      createdAt: now,
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
  return { id }
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
  const diary = graphDiaryInstant(options.sourceRef ?? null, now)
  const shardMonth = diary.shardMonth
  const edgeType = GRAPH_EDGE_TYPES.includes(options.edgeType as (typeof GRAPH_EDGE_TYPES)[number])
    ? options.edgeType
    : 'relates_to'
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const id =
    options.id ||
    graphEdgeId(options.vaultId, options.fromId, options.toId, edgeType, options.sourceRef ?? null)
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
      validFrom: diary.validFrom ?? now,
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
  vaultId?: string
}) {
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const repo = new GraphRepository(options.drizzleDb)
  await applyDiaryGraphSurgicalDelete({
    kind: options.kind,
    id: options.id,
    vaultId: options.vaultId,
    manager: graphManager,
    repo
  })
}

export async function mobileMergeGraphNodes(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  vaultId: string
  vaultName: string
  survivorId: string
  loserId: string
  reason?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}): Promise<{ survivorId: string; loserId: string }> {
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const repo = new GraphRepository(options.drizzleDb)
  const result = await mergeDiaryGraphNodes({
    vaultId: options.vaultId,
    vaultName: options.vaultName,
    survivorId: options.survivorId,
    loserId: options.loserId,
    reason: options.reason,
    manager: graphManager,
    repo
  })
  await syncDiaryGraphMergeIntoIndex({
    loserId: result.loserId,
    syncPendingIndex: (opts) =>
      syncMobileGraphPendingIndex({
        drizzleDb: options.drizzleDb,
        embeddingProvider: options.embeddingProvider,
        embeddingModelId: options.embeddingModelId,
        absentSweep: opts?.absentSweep
      }),
    softDeleteNode: (id) => repo.softDeleteNode(id)
  })
  return result
}

export async function mobileMergeGraphNodeGroup(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  vaultId: string
  vaultName: string
  survivorId: string
  loserIds: string[]
  reason?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}): Promise<{ survivorId: string; loserIds: string[] }> {
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const repo = new GraphRepository(options.drizzleDb)
  const result = await mergeDiaryGraphNodeGroup({
    vaultId: options.vaultId,
    vaultName: options.vaultName,
    survivorId: options.survivorId,
    loserIds: options.loserIds,
    reason: options.reason,
    manager: graphManager,
    repo
  })
  await syncDiaryGraphMergeGroupIntoIndex({
    loserIds: result.loserIds,
    syncPendingIndex: (opts) =>
      syncMobileGraphPendingIndex({
        drizzleDb: options.drizzleDb,
        embeddingProvider: options.embeddingProvider,
        embeddingModelId: options.embeddingModelId,
        absentSweep: opts?.absentSweep
      }),
    softDeleteNode: (id) => repo.softDeleteNode(id)
  })
  return result
}

export async function mobileClearLifeGraph(options: {
  vaultId: string
  vaultName: string
  drizzleDb: AppDatabase
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
  stopExtract?: () => void
}): Promise<{ shardCount: number }> {
  const freshness = ensureMobileGraphFreshnessBound(options)
  const { graphManager } = ensureMobileRawDataRuntime(options)
  return clearLifeGraphData({
    vaultId: options.vaultId,
    graphRepo: new GraphRepository(options.drizzleDb),
    graphManager,
    freshness,
    stopExtract: options.stopExtract
  })
}
