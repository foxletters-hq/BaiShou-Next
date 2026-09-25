import {
  applySuspectReasonToProps,
  removeSuspectReasonFromProps,
  type IFileSystem,
  type IStoragePathService
} from '@baishou/core-mobile'
import { GraphRepository, type AppDatabase } from '@baishou/database'
import type { IAIProvider } from '@baishou/ai'
import {
  expandApprovedGraphReviewEdgeIds,
  graphDiaryInstant,
  isGraphReviewStatus,
  removeSimilarPendingPeerFromProps,
  uniqueNonEmptyIds,
  type GraphSetReviewsBatchInput
} from '@baishou/shared'
import i18n from 'i18next'
import {
  ensureMobileRawDataRuntime,
  syncMobileGraphPendingIndex
} from './mobile-raw-data-source.runtime'
import { parseGraphNodePropsJson } from './graph-name-candidates.util'

async function writeMobileNodeReview(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  nodeId: string
  reviewStatus: 'approved' | 'rejected'
  vaultDisplayName?: string
}) {
  const repo = new GraphRepository(options.drizzleDb)
  const node = await repo.getNodeById(options.nodeId)
  if (!node) {
    throw new Error(i18n.t('graph.node_not_found', '节点不存在'))
  }
  const now = Date.now()
  const { graphManager } = ensureMobileRawDataRuntime(options)

  if (options.reviewStatus === 'rejected') {
    const related = await repo.listEntityTimeline(node.vaultId, options.nodeId, {
      approvedOnly: false,
      limit: 500
    })
    for (const edge of related.edges) {
      if (edge.reviewStatus === 'rejected' || edge.deletedAt != null) continue
      await mobileSetEdgeReviewInner({
        ...options,
        edgeId: edge.id,
        reviewStatus: 'rejected',
        approvePendingEndpoints: false,
        skipSync: true
      })
    }
  }

  const props = removeSuspectReasonFromProps(parseGraphNodePropsJson(node.propsJson))
  await graphManager.writeRecord(
    {
      id: node.id,
      schemaVersion: 1,
      vaultId: node.vaultId,
      vaultName: options.vaultDisplayName ?? node.vaultId,
      nodeType: node.nodeType,
      name: node.name,
      discriminator: node.discriminator ?? '',
      aliases: node.aliases,
      summary: node.summary,
      props,
      mentionCount: node.mentionCount,
      firstSeenAt: node.firstSeenAt ?? now,
      lastSeenAt: node.lastSeenAt ?? now,
      origin: node.origin as 'ai' | 'user',
      shardMonth: node.shardMonth || graphDiaryInstant(null, now).shardMonth,
      createdAt: node.createdAt,
      updatedAt: now,
      deletedAt: null,
      reviewStatus: options.reviewStatus
    },
    { collection: 'nodes' }
  )
}

export async function mobileDismissSimilarPair(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  nodeId: string
  peerId: string
  vaultDisplayName?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}): Promise<void> {
  const peerId = options.peerId.trim()
  if (!peerId) return
  const repo = new GraphRepository(options.drizzleDb)
  const node = await repo.getNodeById(options.nodeId)
  if (!node) {
    throw new Error(i18n.t('graph.node_not_found', '节点不存在'))
  }
  const now = Date.now()
  const { graphManager } = ensureMobileRawDataRuntime(options)
  await graphManager.writeRecord(
    {
      id: node.id,
      schemaVersion: 1,
      vaultId: node.vaultId,
      vaultName: options.vaultDisplayName ?? node.vaultId,
      nodeType: node.nodeType,
      name: node.name,
      discriminator: node.discriminator ?? '',
      aliases: node.aliases,
      summary: node.summary,
      props: removeSimilarPendingPeerFromProps(parseGraphNodePropsJson(node.propsJson), peerId),
      mentionCount: node.mentionCount,
      firstSeenAt: node.firstSeenAt ?? now,
      lastSeenAt: node.lastSeenAt ?? now,
      origin: node.origin as 'ai' | 'user',
      shardMonth: node.shardMonth || graphDiaryInstant(null, now).shardMonth,
      createdAt: node.createdAt,
      updatedAt: now,
      deletedAt: null,
      reviewStatus: (node.reviewStatus as 'approved' | 'pending' | 'rejected') || 'approved'
    },
    { collection: 'nodes' }
  )
  await syncMobileGraphPendingIndex({
    drizzleDb: options.drizzleDb,
    embeddingProvider: options.embeddingProvider,
    embeddingModelId: options.embeddingModelId
  })
}

export async function writeMobileNodeSuspectReason(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  nodeId: string
  reason: string
  vaultDisplayName?: string
}): Promise<void> {
  const trimmed = options.reason.trim()
  if (!trimmed) return
  const repo = new GraphRepository(options.drizzleDb)
  const node = await repo.getNodeById(options.nodeId)
  if (!node) {
    throw new Error(i18n.t('graph.node_not_found', '节点不存在'))
  }
  const now = Date.now()
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const props = parseGraphNodePropsJson(node.propsJson)
  await graphManager.writeRecord(
    {
      id: node.id,
      schemaVersion: 1,
      vaultId: node.vaultId,
      vaultName: options.vaultDisplayName ?? node.vaultId,
      nodeType: node.nodeType,
      name: node.name,
      discriminator: node.discriminator ?? '',
      aliases: node.aliases,
      summary: node.summary,
      props: applySuspectReasonToProps(props, trimmed),
      mentionCount: node.mentionCount,
      firstSeenAt: node.firstSeenAt ?? now,
      lastSeenAt: node.lastSeenAt ?? now,
      origin: node.origin as 'ai' | 'user',
      shardMonth: node.shardMonth || graphDiaryInstant(null, now).shardMonth,
      createdAt: node.createdAt,
      updatedAt: now,
      deletedAt: null,
      reviewStatus: 'pending'
    },
    { collection: 'nodes' }
  )
}

/** Internal edge review without recursive node cascade sync. */
async function mobileSetEdgeReviewInner(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  edgeId: string
  reviewStatus: 'approved' | 'rejected'
  vaultDisplayName?: string
  approvePendingEndpoints?: boolean
  skipSync?: boolean
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}) {
  const repo = new GraphRepository(options.drizzleDb)
  const edge = await repo.getEdgeById(options.edgeId)
  if (!edge) {
    throw new Error(i18n.t('auto.apps.mobile.src.services.mobile.graph.service.L142', '边不存在'))
  }
  const now = Date.now()
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const props = parseGraphNodePropsJson(edge.propsJson)
  await graphManager.writeRecord(
    {
      id: edge.id,
      schemaVersion: 1,
      vaultId: edge.vaultId,
      vaultName: options.vaultDisplayName ?? edge.vaultId,
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
      deletedAt: null
    },
    { collection: 'edges' }
  )

  if (options.reviewStatus === 'approved' && options.approvePendingEndpoints !== false) {
    for (const endpointId of [edge.fromId, edge.toId]) {
      const node = await repo.getNodeById(endpointId, edge.vaultId)
      if (node && node.reviewStatus === 'pending') {
        await writeMobileNodeReview({
          ...options,
          nodeId: endpointId,
          reviewStatus: 'approved'
        })
      }
    }
  }

  if (!options.skipSync) {
    await syncMobileGraphPendingIndex({
      drizzleDb: options.drizzleDb,
      embeddingProvider: options.embeddingProvider,
      embeddingModelId: options.embeddingModelId
    })
  }
}

export async function mobileSetNodeReview(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  nodeId: string
  reviewStatus: 'approved' | 'rejected'
  vaultDisplayName?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}) {
  await writeMobileNodeReview(options)
  await syncMobileGraphPendingIndex({
    drizzleDb: options.drizzleDb,
    embeddingProvider: options.embeddingProvider,
    embeddingModelId: options.embeddingModelId
  })
}

export async function mobileSetEdgeReview(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  edgeId: string
  reviewStatus: 'approved' | 'rejected'
  vaultDisplayName?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}) {
  await mobileSetEdgeReviewInner({
    ...options,
    approvePendingEndpoints: true
  })
}

export async function mobileSetReviewsBatch(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  vaultId: string
  reviewStatus: GraphSetReviewsBatchInput['reviewStatus']
  nodeIds?: string[]
  edgeIds?: string[]
  allPending?: boolean
  vaultDisplayName?: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}): Promise<{ ok: true; nodeCount: number; edgeCount: number }> {
  if (!isGraphReviewStatus(options.reviewStatus)) {
    throw new Error(i18n.t('graph.invalid_review_status', '无效的审核状态'))
  }
  const repo = new GraphRepository(options.drizzleDb)
  const [pendingNodes, pendingEdges] = await Promise.all([
    repo.listPendingNodes(options.vaultId),
    repo.listPendingEdges(options.vaultId)
  ])
  const nodeIds = uniqueNonEmptyIds(
    options.allPending ? pendingNodes.map((node) => node.id) : options.nodeIds
  )
  const edgeIds = options.allPending
    ? uniqueNonEmptyIds(pendingEdges.map((edge) => edge.id))
    : options.reviewStatus === 'approved'
      ? expandApprovedGraphReviewEdgeIds({
          nodeIds,
          edgeIds: options.edgeIds,
          pendingEdges
        })
      : uniqueNonEmptyIds(options.edgeIds)

  for (const nodeId of nodeIds) {
    const node = await repo.getNodeById(nodeId)
    if (!node) continue
    await writeMobileNodeReview({
      ...options,
      nodeId,
      reviewStatus: options.reviewStatus
    })
  }
  for (const edgeId of edgeIds) {
    const edge = await repo.getEdgeById(edgeId)
    if (!edge) continue
    await mobileSetEdgeReviewInner({
      ...options,
      edgeId,
      reviewStatus: options.reviewStatus,
      approvePendingEndpoints: options.reviewStatus === 'approved',
      skipSync: true
    })
  }
  await syncMobileGraphPendingIndex({
    drizzleDb: options.drizzleDb,
    embeddingProvider: options.embeddingProvider,
    embeddingModelId: options.embeddingModelId
  })
  return { ok: true, nodeCount: nodeIds.length, edgeCount: edgeIds.length }
}
