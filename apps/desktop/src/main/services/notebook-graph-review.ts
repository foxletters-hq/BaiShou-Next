import {
  expandApprovedGraphReviewEdgeIds,
  isGraphReviewStatus,
  uniqueNonEmptyIds,
  type GraphSetReviewsBatchInput,
  type NotebookGraphEdgeRawRecord,
  type NotebookGraphNodeRawRecord
} from '@baishou/shared'
import {
  NotebookGraphIndexService,
  NotebookGraphRawManager,
  notebookGraphSourceIdFromSourceRef
} from '@baishou/core-desktop'
import { knowledgeConnectionManager, NotebookGraphRepository } from '@baishou/database-desktop'
import { fileSystem } from './node-file-system'
import { pathService, resolveActiveVaultId, resolveVaultNameById } from '../ipc/vault.ipc'

function requireVaultId(): string {
  const id = resolveActiveVaultId()?.trim() || ''
  if (!id) throw new Error('active vault not ready')
  return id
}

function requireNotebookId(notebookId: string): string {
  const id = notebookId.trim()
  if (!id) throw new Error('notebookId required')
  return id
}

function parseProps(propsJson: string | null | undefined): Record<string, unknown> {
  try {
    return JSON.parse(propsJson || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

function parseAliases(raw: string | string[] | undefined): string[] {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string')
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string')
      }
    } catch {
      /* ignore */
    }
  }
  return []
}

function requireRepo(): NotebookGraphRepository {
  if (!knowledgeConnectionManager.isConnected()) {
    throw new Error('knowledge db not connected')
  }
  return new NotebookGraphRepository(knowledgeConnectionManager.getDb())
}

function createRaw(): NotebookGraphRawManager {
  return new NotebookGraphRawManager(pathService, fileSystem)
}

async function syncNotebookGraphIndex(notebookId: string): Promise<void> {
  const vaultId = requireVaultId()
  const raw = createRaw()
  const repo = requireRepo()
  const index = new NotebookGraphIndexService(raw, repo)
  await index.syncPendingIndex({ vaultId, notebookId, absentSweep: 'off' })
}

async function writeNodeReview(
  notebookId: string,
  nodeId: string,
  reviewStatus: 'approved' | 'rejected'
): Promise<void> {
  const repo = requireRepo()
  const vaultId = requireVaultId()
  const node = await repo.getNodeById(nodeId, vaultId, notebookId)
  if (!node) throw new Error(`Node not found: ${nodeId}`)
  const now = Date.now()
  const related = await repo.getNeighborhood({
    vaultId,
    notebookId,
    nodeId,
    maxNodes: 5000
  })

  if (reviewStatus === 'rejected') {
    for (const edge of related.edges) {
      if (edge.reviewStatus === 'rejected' || edge.deletedAt != null) continue
      await writeEdgeReview(notebookId, edge.id, 'rejected', { approvePendingEndpoints: false })
    }
  }

  const props = parseProps(node.propsJson)
  const sourceIdFromProps = typeof props.sourceId === 'string' ? props.sourceId.trim() : ''
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
    vaultName: resolveVaultNameById(vaultId),
    notebookId,
    nodeType: node.nodeType,
    name: node.name,
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
  await createRaw().writeRecord(notebookId, 'nodes', {
    ...record,
    sourceId: sourceId || undefined
  })
}

async function writeEdgeReview(
  notebookId: string,
  edgeId: string,
  reviewStatus: 'approved' | 'rejected',
  opts?: { approvePendingEndpoints?: boolean }
): Promise<void> {
  const repo = requireRepo()
  const vaultId = requireVaultId()
  const edge = await repo.getEdgeById(edgeId, vaultId, notebookId)
  if (!edge) throw new Error(`Edge not found: ${edgeId}`)
  const now = Date.now()
  const record: NotebookGraphEdgeRawRecord = {
    id: edge.id,
    schemaVersion: 1,
    vaultId,
    vaultName: resolveVaultNameById(vaultId),
    notebookId,
    fromId: edge.fromId,
    toId: edge.toId,
    edgeType: edge.edgeType,
    props: parseProps(edge.propsJson),
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
  await createRaw().writeEdge(record)

  if (reviewStatus === 'approved' && opts?.approvePendingEndpoints !== false) {
    for (const endpointId of [edge.fromId, edge.toId]) {
      const node = await repo.getNodeById(endpointId, vaultId, notebookId)
      if (node?.reviewStatus === 'pending') {
        await writeNodeReview(notebookId, endpointId, 'approved')
      }
    }
  }
}

export async function reviewNotebookGraphNode(input: {
  notebookId: string
  nodeId: string
  reviewStatus: 'approved' | 'rejected'
}): Promise<{ ok: true }> {
  const notebookId = requireNotebookId(input.notebookId)
  if (!isGraphReviewStatus(input.reviewStatus)) throw new Error('Invalid review status')
  await writeNodeReview(notebookId, input.nodeId, input.reviewStatus)
  if (input.reviewStatus === 'approved') {
    const vaultId = requireVaultId()
    const pendingEdges = await requireRepo().listPendingEdges(vaultId, notebookId)
    for (const edge of pendingEdges) {
      if (edge.fromId === input.nodeId || edge.toId === input.nodeId) {
        await writeEdgeReview(notebookId, edge.id, 'approved', { approvePendingEndpoints: true })
      }
    }
  }
  await syncNotebookGraphIndex(notebookId)
  return { ok: true }
}

export async function reviewNotebookGraphEdge(input: {
  notebookId: string
  edgeId: string
  reviewStatus: 'approved' | 'rejected'
}): Promise<{ ok: true }> {
  const notebookId = requireNotebookId(input.notebookId)
  if (!isGraphReviewStatus(input.reviewStatus)) throw new Error('Invalid review status')
  await writeEdgeReview(notebookId, input.edgeId, input.reviewStatus, {
    approvePendingEndpoints: input.reviewStatus === 'approved'
  })
  await syncNotebookGraphIndex(notebookId)
  return { ok: true }
}

export async function reviewNotebookGraphBatch(
  input: GraphSetReviewsBatchInput & { notebookId: string }
): Promise<{ ok: true; nodeCount: number; edgeCount: number }> {
  const notebookId = requireNotebookId(input.notebookId)
  if (!isGraphReviewStatus(input.reviewStatus)) throw new Error('Invalid review status')
  const vaultId = requireVaultId()
  const repo = requireRepo()
  const [pendingNodes, pendingEdges] = await Promise.all([
    repo.listPendingNodes(vaultId, notebookId),
    repo.listPendingEdges(vaultId, notebookId)
  ])
  const nodeIds = uniqueNonEmptyIds(
    input.allPending ? pendingNodes.map((node) => node.id) : input.nodeIds
  )
  const edgeIds = input.allPending
    ? uniqueNonEmptyIds(pendingEdges.map((edge) => edge.id))
    : input.reviewStatus === 'approved'
      ? expandApprovedGraphReviewEdgeIds({
          nodeIds,
          edgeIds: input.edgeIds,
          pendingEdges
        })
      : uniqueNonEmptyIds(input.edgeIds)

  for (const nodeId of nodeIds) {
    const node = await repo.getNodeById(nodeId, vaultId, notebookId)
    if (!node) continue
    await writeNodeReview(notebookId, nodeId, input.reviewStatus)
  }
  for (const edgeId of edgeIds) {
    const edge = await repo.getEdgeById(edgeId, vaultId, notebookId)
    if (!edge) continue
    await writeEdgeReview(notebookId, edgeId, input.reviewStatus, {
      approvePendingEndpoints: input.reviewStatus === 'approved'
    })
  }
  await syncNotebookGraphIndex(notebookId)
  return { ok: true, nodeCount: nodeIds.length, edgeCount: edgeIds.length }
}
