import {
  parseGraphNodePropsRecord,
  type NotebookGraphEdgeRawRecord,
  type NotebookGraphNodeRawRecord
} from '@baishou/shared'
import { notebookGraphSourceIdFromSourceRef } from '@baishou/core-mobile'
import type { NotebookGraphRepository } from '@baishou/database/expo'
import { notifyNotebookGraphChanged } from './mobile-notebook-graph-events'
import { notebookGraphNodeReviewNeedsNeighborhood } from './notebook-graph-review.util'
import {
  createRaw,
  parseAliases,
  requireRepo,
  resolveVaultName,
  scheduleNotebookGraphIndexSync
} from './mobile-notebook-graph-review.runtime'

/** 把一次复核（单个或批量）要写的图谱记录攒起来，最后统一批量落盘。 */

export type ReviewWriteSink = {
  nodes: Map<string, NotebookGraphNodeRawRecord & { sourceId?: string }>
  edges: Map<string, NotebookGraphEdgeRawRecord>
}

type TouchingEdgeRow = Awaited<ReturnType<NotebookGraphRepository['listEdgesTouching']>>[number]

export function createReviewWriteSink(): ReviewWriteSink {
  return { nodes: new Map(), edges: new Map() }
}

/** 统一落盘：每个分片只追加一次；无论成功失败都排队一次后台索引同步（失败时已写入的部分也要同步）。 */
export async function commitReviewWrites(
  notebookId: string,
  vaultId: string,
  sink: ReviewWriteSink
): Promise<void> {
  try {
    const raw = createRaw()
    if (sink.nodes.size > 0) await raw.writeRecords(notebookId, 'nodes', [...sink.nodes.values()])
    if (sink.edges.size > 0) await raw.writeRecords(notebookId, 'edges', [...sink.edges.values()])
  } finally {
    scheduleNotebookGraphIndexSync(notebookId, vaultId)
    notifyNotebookGraphChanged(notebookId)
  }
}

/** 与选中节点相连的待审边：逐个节点走 from/to 索引，O(k·d·log E)，不扫描整本笔记本的边。 */
export async function listPendingEdgesTouchingNodes(
  repo: NotebookGraphRepository,
  vaultId: string,
  notebookId: string,
  nodeIds: readonly string[]
): Promise<TouchingEdgeRow[]> {
  const byId = new Map<string, TouchingEdgeRow>()
  for (const nodeId of nodeIds) {
    for (const edge of await repo.listEdgesTouching(vaultId, notebookId, nodeId)) {
      if (edge.reviewStatus === 'pending') byId.set(edge.id, edge)
    }
  }
  return [...byId.values()]
}

export async function writeNodeReview(
  notebookId: string,
  nodeId: string,
  reviewStatus: 'approved' | 'rejected',
  vaultId: string,
  sink: ReviewWriteSink
): Promise<void> {
  const repo = await requireRepo()
  const node = await repo.getNodeById(nodeId, vaultId, notebookId)
  if (!node) throw new Error(`Node not found: ${nodeId}`)
  const now = Date.now()
  const props = parseGraphNodePropsRecord(node.propsJson)
  const sourceIdFromProps = typeof props.sourceId === 'string' ? props.sourceId.trim() : ''
  const related = notebookGraphNodeReviewNeedsNeighborhood({
    reviewStatus,
    shardMonth: node.shardMonth,
    sourceId: sourceIdFromProps
  })
    ? await repo.getNeighborhood({
        vaultId,
        notebookId,
        nodeId,
        maxNodes: 5000
      })
    : { edges: [] as Awaited<ReturnType<NotebookGraphRepository['getNeighborhood']>>['edges'] }

  if (reviewStatus === 'rejected') {
    for (const edge of related.edges) {
      if (edge.reviewStatus === 'rejected' || edge.deletedAt != null) continue
      await writeEdgeReview(
        notebookId,
        edge.id,
        'rejected',
        vaultId,
        { approvePendingEndpoints: false },
        sink
      )
    }
  }

  let sourceId = sourceIdFromProps
  let shardMonth = (node.shardMonth || sourceIdFromProps).trim()
  if (!shardMonth) {
    for (const edge of related.edges) {
      const fromRef = notebookGraphSourceIdFromSourceRef(edge.sourceRef)
      const fromShard = edge.shardMonth?.trim() || ''
      if (fromRef) {
        shardMonth = fromRef
        sourceId = fromRef
        break
      }
      if (fromShard) {
        shardMonth = fromShard
        sourceId = fromShard
        break
      }
    }
  }
  if (!shardMonth) throw new Error(`Node shard missing: ${nodeId}`)

  const record: NotebookGraphNodeRawRecord = {
    id: node.id,
    schemaVersion: 1,
    vaultId,
    vaultName: await resolveVaultName(vaultId),
    notebookId,
    nodeType: node.nodeType,
    name: node.name,
    discriminator: node.discriminator ?? '',
    aliases: parseAliases(node.aliases),
    summary: node.summary || '',
    props,
    mentionCount: node.mentionCount,
    firstSeenAt: node.firstSeenAt ?? now,
    lastSeenAt: node.lastSeenAt ?? now,
    origin: node.origin === 'user' ? 'user' : 'ai',
    shardMonth,
    createdAt: node.createdAt,
    updatedAt: now,
    deletedAt: null,
    reviewStatus
  }
  sink.nodes.set(node.id, { ...record, sourceId: sourceId || undefined })
}

export async function writeEdgeReview(
  notebookId: string,
  edgeId: string,
  reviewStatus: 'approved' | 'rejected',
  vaultId: string,
  opts: { approvePendingEndpoints?: boolean } | undefined,
  sink: ReviewWriteSink
): Promise<void> {
  const repo = await requireRepo()
  const edge = await repo.getEdgeById(edgeId, vaultId, notebookId)
  if (!edge) throw new Error(`Edge not found: ${edgeId}`)
  const now = Date.now()
  const record: NotebookGraphEdgeRawRecord = {
    id: edge.id,
    schemaVersion: 1,
    vaultId,
    vaultName: await resolveVaultName(vaultId),
    notebookId,
    fromId: edge.fromId,
    toId: edge.toId,
    edgeType: edge.edgeType,
    props: parseGraphNodePropsRecord(edge.propsJson),
    validFrom: edge.validFrom ?? null,
    validTo: edge.validTo ?? null,
    isCurrent: reviewStatus === 'rejected' ? false : edge.isCurrent === 1,
    sourceKind: edge.sourceKind,
    sourceRef: edge.sourceRef,
    sourceExcerpt: edge.sourceExcerpt,
    sourceContentHash: edge.sourceContentHash,
    confidence: edge.confidence,
    origin: edge.origin === 'user' ? 'user' : 'ai',
    reviewStatus,
    shardMonth: edge.shardMonth,
    createdAt: edge.createdAt,
    updatedAt: now,
    deletedAt: null
  }
  sink.edges.set(edge.id, record)

  if (reviewStatus === 'approved' && opts?.approvePendingEndpoints !== false) {
    for (const endpointId of [edge.fromId, edge.toId]) {
      const node = await repo.getNodeById(endpointId, vaultId, notebookId)
      if (node?.reviewStatus === 'pending') {
        await writeNodeReview(notebookId, endpointId, 'approved', vaultId, sink)
      }
    }
  }
}
