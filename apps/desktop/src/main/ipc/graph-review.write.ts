import {
  applySuspectReasonToProps,
  type GraphEdgeRawRecord,
  type GraphNodeRawRecord
} from '@baishou/core-desktop'
import {
  expandApprovedGraphReviewEdgeIds,
  graphDiaryInstant,
  isGraphReviewStatus,
  removeSimilarPendingPeerFromProps,
  uniqueNonEmptyIds,
  type GraphSetReviewsBatchInput
} from '@baishou/shared'
import { resolveVaultNameById } from './vault.ipc'
import { getGraphRawManager, syncGraphPendingIndex } from '../services/raw-data-source.runtime'
import { parseProps, requireGraphRepo, requireVaultId, writeVaultId } from './graph-ipc.context'

export async function writeNodeReview(
  nodeId: string,
  reviewStatus: 'approved' | 'rejected'
): Promise<void> {
  const repo = requireGraphRepo()
  const node = await repo.getNodeById(nodeId)
  if (!node) throw new Error(`Node not found: ${nodeId}`)
  const now = Date.now()
  const vaultId = writeVaultId(node.vaultId)

  // Rejecting a node also rejects/discards connected edges so recall stays clean.
  if (reviewStatus === 'rejected') {
    const related = await repo.listEntityTimeline(vaultId, nodeId, {
      approvedOnly: false,
      limit: 500
    })
    for (const edge of related.edges) {
      if (edge.reviewStatus === 'rejected' || edge.deletedAt != null) continue
      await writeEdgeReview(edge.id, 'rejected', { approvePendingEndpoints: false })
    }
  }

  const record: GraphNodeRawRecord = {
    id: node.id,
    schemaVersion: 1,
    vaultId,
    vaultName: resolveVaultNameById(vaultId),
    nodeType: node.nodeType,
    name: node.name,
    // 复核只改状态；缺这个字段时 applyRawNode 会归一成空串，拆出节点的身份就被冲掉。
    discriminator: node.discriminator ?? '',
    aliases: node.aliases,
    summary: node.summary,
    props: parseProps(node.propsJson),
    mentionCount: node.mentionCount,
    firstSeenAt: node.firstSeenAt ?? now,
    lastSeenAt: node.lastSeenAt ?? now,
    origin: node.origin as 'ai' | 'user',
    shardMonth: node.shardMonth || graphDiaryInstant(null, now).shardMonth,
    createdAt: node.createdAt,
    updatedAt: now,
    deletedAt: null,
    reviewStatus
  }
  await getGraphRawManager().writeRecord(record, { collection: 'nodes' })
}

export async function writeDismissSimilarPair(nodeId: string, peerId: string): Promise<void> {
  const trimmedPeer = peerId.trim()
  if (!trimmedPeer) return
  const repo = requireGraphRepo()
  const node = await repo.getNodeById(nodeId)
  if (!node) throw new Error(`Node not found: ${nodeId}`)
  const now = Date.now()
  const vaultId = writeVaultId(node.vaultId)
  const record: GraphNodeRawRecord = {
    id: node.id,
    schemaVersion: 1,
    vaultId,
    vaultName: resolveVaultNameById(vaultId),
    nodeType: node.nodeType,
    name: node.name,
    discriminator: node.discriminator ?? '',
    aliases: node.aliases,
    summary: node.summary,
    props: removeSimilarPendingPeerFromProps(parseProps(node.propsJson), trimmedPeer),
    mentionCount: node.mentionCount,
    firstSeenAt: node.firstSeenAt ?? now,
    lastSeenAt: node.lastSeenAt ?? now,
    origin: node.origin as 'ai' | 'user',
    shardMonth: node.shardMonth || graphDiaryInstant(null, now).shardMonth,
    createdAt: node.createdAt,
    updatedAt: now,
    deletedAt: null,
    reviewStatus: (node.reviewStatus as GraphNodeRawRecord['reviewStatus']) || 'approved'
  }
  await getGraphRawManager().writeRecord(record, { collection: 'nodes' })
  await syncGraphPendingIndex()
}

export async function writeNodeSuspectReason(nodeId: string, reason: string): Promise<void> {
  const trimmed = reason.trim()
  if (!trimmed) return
  const repo = requireGraphRepo()
  const node = await repo.getNodeById(nodeId)
  if (!node) throw new Error(`Node not found: ${nodeId}`)
  const now = Date.now()
  const vaultId = writeVaultId(node.vaultId)
  const record: GraphNodeRawRecord = {
    id: node.id,
    schemaVersion: 1,
    vaultId,
    vaultName: resolveVaultNameById(vaultId),
    nodeType: node.nodeType,
    name: node.name,
    discriminator: node.discriminator ?? '',
    aliases: node.aliases,
    summary: node.summary,
    props: applySuspectReasonToProps(parseProps(node.propsJson), trimmed),
    mentionCount: node.mentionCount,
    firstSeenAt: node.firstSeenAt ?? now,
    lastSeenAt: node.lastSeenAt ?? now,
    origin: node.origin as 'ai' | 'user',
    shardMonth: node.shardMonth || graphDiaryInstant(null, now).shardMonth,
    createdAt: node.createdAt,
    updatedAt: now,
    deletedAt: null,
    reviewStatus: 'pending'
  }
  await getGraphRawManager().writeRecord(record, { collection: 'nodes' })
}

export async function writeEdgeReview(
  edgeId: string,
  reviewStatus: 'approved' | 'rejected',
  opts?: { approvePendingEndpoints?: boolean }
): Promise<void> {
  const repo = requireGraphRepo()
  const edge = await repo.getEdgeById(edgeId)
  if (!edge) throw new Error(`Edge not found: ${edgeId}`)
  const now = Date.now()
  const vaultId = writeVaultId(edge.vaultId)
  const record: GraphEdgeRawRecord = {
    id: edge.id,
    schemaVersion: 1,
    vaultId,
    vaultName: resolveVaultNameById(vaultId),
    fromId: edge.fromId,
    toId: edge.toId,
    edgeType: edge.edgeType,
    props: parseProps(edge.propsJson),
    validFrom: edge.validFrom,
    validTo: edge.validTo,
    isCurrent: reviewStatus === 'rejected' ? false : edge.isCurrent,
    sourceKind: edge.sourceKind,
    sourceRef: edge.sourceRef,
    sourceExcerpt: edge.sourceExcerpt,
    sourceContentHash: edge.sourceContentHash,
    confidence: edge.confidence,
    origin: edge.origin as 'ai' | 'user',
    reviewStatus,
    shardMonth: edge.shardMonth,
    createdAt: edge.createdAt,
    updatedAt: now,
    deletedAt: null
  }
  await getGraphRawManager().writeRecord(record, { collection: 'edges' })

  // Approving an edge must also approve pending endpoints so Agent can see them.
  if (reviewStatus === 'approved' && opts?.approvePendingEndpoints !== false) {
    for (const endpointId of [edge.fromId, edge.toId]) {
      const node = await repo.getNodeById(endpointId, vaultId)
      if (node && node.reviewStatus === 'pending') {
        await writeNodeReview(endpointId, 'approved')
      }
    }
  }
}

export async function applyGraphReviews(
  opts: GraphSetReviewsBatchInput
): Promise<{ ok: true; nodeCount: number; edgeCount: number }> {
  if (!isGraphReviewStatus(opts.reviewStatus)) {
    throw new Error('Invalid review status')
  }
  const repo = requireGraphRepo()
  const vaultId = requireVaultId()
  const [pendingNodes, pendingEdges] = await Promise.all([
    repo.listPendingNodes(vaultId),
    repo.listPendingEdges(vaultId)
  ])
  const nodeIds = uniqueNonEmptyIds(
    opts.allPending ? pendingNodes.map((node) => node.id) : opts.nodeIds
  )
  const edgeIds = opts.allPending
    ? uniqueNonEmptyIds(pendingEdges.map((edge) => edge.id))
    : opts.reviewStatus === 'approved'
      ? expandApprovedGraphReviewEdgeIds({
          nodeIds,
          edgeIds: opts.edgeIds,
          pendingEdges
        })
      : uniqueNonEmptyIds(opts.edgeIds)

  for (const nodeId of nodeIds) {
    const node = await repo.getNodeById(nodeId)
    if (!node) continue
    await writeNodeReview(nodeId, opts.reviewStatus)
  }
  for (const edgeId of edgeIds) {
    const edge = await repo.getEdgeById(edgeId)
    if (!edge) continue
    await writeEdgeReview(edgeId, opts.reviewStatus, {
      approvePendingEndpoints: opts.reviewStatus === 'approved'
    })
  }
  await syncGraphPendingIndex()
  return { ok: true, nodeCount: nodeIds.length, edgeCount: edgeIds.length }
}
