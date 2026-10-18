import {
  collectSimilarPendingPairs,
  expandApprovedGraphReviewEdgeIds,
  isGraphReviewStatus,
  logger,
  parseGraphNodePropsRecord,
  removeSimilarPendingPeerFromProps,
  uniqueNonEmptyIds,
  type GraphSetReviewsBatchInput,
  type GraphSimilarPendingPair,
  type NotebookGraphEdgeRawRecord,
  type NotebookGraphNodeRawRecord
} from '@baishou/shared'
import i18n from 'i18next'
import {
  NotebookGraphIndexService,
  NotebookGraphRawManager,
  notebookGraphSourceIdFromSourceRef
} from '@baishou/core-mobile'
import { NotebookGraphRepository, expoKnowledgeConnectionManager } from '@baishou/database/expo'
import { ensureMobileKnowledgeConnected } from './mobile-knowledge-repo'
import { createMobileFileSystem } from './create-mobile-file-system'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import { resolveMobileEmbeddingForHydration } from './mobile-raw-data-source.runtime'
import { notebookGraphNodeReviewNeedsNeighborhood } from './notebook-graph-review.util'

function requireVaultId(vaultId: string): string {
  const id = vaultId.trim()
  if (!id) throw new Error('active vault not ready')
  return id
}

function requireNotebookId(notebookId: string): string {
  const id = notebookId.trim()
  if (!id) throw new Error('notebookId required')
  return id
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

async function requireRepo(): Promise<NotebookGraphRepository> {
  await ensureMobileKnowledgeConnected()
  return new NotebookGraphRepository(expoKnowledgeConnectionManager.getDb())
}

function createRaw(): NotebookGraphRawManager {
  const runtime = agentDbRuntimeRef.current
  if (!runtime?.pathService) throw new Error('runtime not ready')
  return new NotebookGraphRawManager(runtime.pathService, createMobileFileSystem())
}

async function resolveVaultName(vaultId: string): Promise<string> {
  const runtime = agentDbRuntimeRef.current
  const name = await runtime?.pathService?.getActiveVaultNameForContext?.().catch(() => vaultId)
  return name?.trim() || vaultId
}

async function syncNotebookGraphIndex(notebookId: string, vaultId: string): Promise<void> {
  const runtime = agentDbRuntimeRef.current
  const raw = createRaw()
  const repo = await requireRepo()
  let embedQuery: ((text: string) => Promise<number[] | null>) | undefined
  let modelId: string | undefined
  if (runtime?.settingsManager) {
    try {
      const { EmbeddingAdapter } = await import('@baishou/ai')
      const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
      if (emb.embeddingProvider && emb.embeddingModelId) {
        const adapter = new EmbeddingAdapter(emb.embeddingProvider, emb.embeddingModelId)
        if (adapter.isConfigured) {
          embedQuery = (text) => adapter.embedQuery(text)
          modelId = adapter.embeddingModelId
        }
      }
    } catch {
      /* 没配嵌入时仍写入复核 */
    }
  }
  const index = new NotebookGraphIndexService(
    raw,
    repo,
    embedQuery && modelId ? { embedQuery, modelId } : null
  )
  await index.syncPendingIndex({ vaultId, notebookId, absentSweep: 'off' })
}

import {
  notifyNotebookGraphChanged,
  subscribeNotebookGraphChanged
} from './mobile-notebook-graph-events'
export { notifyNotebookGraphChanged, subscribeNotebookGraphChanged }

/**
 * 复核后的后台索引同步。同一本笔记本同一时间只跑一轮；运行期间再来的请求
 * 合并成一轮补跑，避免连点通过时多轮全量分片同步并发抢 SQLite 与 JS 线程。
 */
const notebookIndexSyncs = new Map<string, { queued: boolean; done: Promise<void> }>()

function scheduleNotebookGraphIndexSync(notebookId: string, vaultId: string): void {
  const key = `${vaultId}\u0000${notebookId}`
  const running = notebookIndexSyncs.get(key)
  if (running) {
    running.queued = true
    return
  }
  const state: { queued: boolean; done: Promise<void> } = {
    queued: false,
    done: Promise.resolve()
  }
  notebookIndexSyncs.set(key, state)
  state.done = (async () => {
    try {
      do {
        state.queued = false
        await syncNotebookGraphIndex(notebookId, vaultId)
      } while (state.queued)
    } catch (e) {
      logger.warn('[NotebookGraphReview] background index sync failed', e as Error)
    } finally {
      notebookIndexSyncs.delete(key)
      notifyNotebookGraphChanged(notebookId)
    }
  })()
}

/** 读取图谱索引前调用：若该笔记本有后台同步在跑，等它结束，避免读到同步前的数据。 */
export async function mobileWaitNotebookGraphIndexSync(
  notebookId: string,
  vaultId: string
): Promise<void> {
  const id = notebookId.trim()
  const vid = vaultId.trim()
  if (!id || !vid) return
  await notebookIndexSyncs.get(`${vid}\u0000${id}`)?.done
}

/** 一次复核（单个或批量）要写的记录先攒在这里，最后统一批量落盘；同一 id 只保留最后一条。 */
type ReviewWriteSink = {
  nodes: Map<string, NotebookGraphNodeRawRecord & { sourceId?: string }>
  edges: Map<string, NotebookGraphEdgeRawRecord>
}

type TouchingEdgeRow = Awaited<ReturnType<NotebookGraphRepository['listEdgesTouching']>>[number]

function createReviewWriteSink(): ReviewWriteSink {
  return { nodes: new Map(), edges: new Map() }
}

/** 统一落盘：每个分片只追加一次；无论成功失败都排队一次后台索引同步（失败时已写入的部分也要同步）。 */
async function commitReviewWrites(
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
async function listPendingEdgesTouchingNodes(
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

async function writeNodeReview(
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

async function writeEdgeReview(
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

export async function mobileReviewNotebookGraphNode(input: {
  notebookId: string
  nodeId: string
  reviewStatus: 'approved' | 'rejected'
  vaultId: string
}): Promise<{ ok: true }> {
  const notebookId = requireNotebookId(input.notebookId)
  const vaultId = requireVaultId(input.vaultId)
  if (!isGraphReviewStatus(input.reviewStatus)) throw new Error('Invalid review status')
  const sink = createReviewWriteSink()
  await writeNodeReview(notebookId, input.nodeId, input.reviewStatus, vaultId, sink)
  if (input.reviewStatus === 'approved') {
    const repo = await requireRepo()
    const touching = await listPendingEdgesTouchingNodes(repo, vaultId, notebookId, [input.nodeId])
    for (const edge of touching) {
      await writeEdgeReview(
        notebookId,
        edge.id,
        'approved',
        vaultId,
        { approvePendingEndpoints: true },
        sink
      )
    }
  }
  await commitReviewWrites(notebookId, vaultId, sink)
  return { ok: true }
}

export async function mobileReviewNotebookGraphEdge(input: {
  notebookId: string
  edgeId: string
  reviewStatus: 'approved' | 'rejected'
  vaultId: string
}): Promise<{ ok: true }> {
  const notebookId = requireNotebookId(input.notebookId)
  const vaultId = requireVaultId(input.vaultId)
  if (!isGraphReviewStatus(input.reviewStatus)) throw new Error('Invalid review status')
  const sink = createReviewWriteSink()
  await writeEdgeReview(
    notebookId,
    input.edgeId,
    input.reviewStatus,
    vaultId,
    { approvePendingEndpoints: input.reviewStatus === 'approved' },
    sink
  )
  await commitReviewWrites(notebookId, vaultId, sink)
  return { ok: true }
}

export async function mobileReviewNotebookGraphBatch(
  input: GraphSetReviewsBatchInput & { notebookId: string; vaultId: string }
): Promise<{ ok: true; nodeCount: number; edgeCount: number }> {
  const notebookId = requireNotebookId(input.notebookId)
  const vaultId = requireVaultId(input.vaultId)
  if (!isGraphReviewStatus(input.reviewStatus)) throw new Error('Invalid review status')
  const repo = await requireRepo()
  const nodeIds = uniqueNonEmptyIds(
    input.allPending
      ? (await repo.listPendingNodes(vaultId, notebookId)).map((node) => node.id)
      : input.nodeIds
  )
  let edgeIds: string[]
  if (input.allPending) {
    edgeIds = uniqueNonEmptyIds(
      (await repo.listPendingEdges(vaultId, notebookId)).map((edge) => edge.id)
    )
  } else if (input.reviewStatus === 'approved') {
    // 只查选中节点相连的待审边（走索引），不再扫描整本笔记本的边
    const touching = await listPendingEdgesTouchingNodes(repo, vaultId, notebookId, nodeIds)
    edgeIds = expandApprovedGraphReviewEdgeIds({
      nodeIds,
      edgeIds: input.edgeIds,
      pendingEdges: touching
    })
  } else {
    edgeIds = uniqueNonEmptyIds(input.edgeIds)
  }

  const sink = createReviewWriteSink()
  for (const nodeId of nodeIds) {
    const node = await repo.getNodeById(nodeId, vaultId, notebookId)
    if (!node) continue
    await writeNodeReview(notebookId, nodeId, input.reviewStatus, vaultId, sink)
  }
  for (const edgeId of edgeIds) {
    const edge = await repo.getEdgeById(edgeId, vaultId, notebookId)
    if (!edge) continue
    await writeEdgeReview(
      notebookId,
      edgeId,
      input.reviewStatus,
      vaultId,
      { approvePendingEndpoints: input.reviewStatus === 'approved' },
      sink
    )
  }
  await commitReviewWrites(notebookId, vaultId, sink)
  return { ok: true, nodeCount: nodeIds.length, edgeCount: edgeIds.length }
}

export async function mobileListNotebookSimilarPendingPairs(input: {
  notebookId: string
  vaultId: string
}): Promise<GraphSimilarPendingPair[]> {
  const notebookId = requireNotebookId(input.notebookId)
  const vaultId = requireVaultId(input.vaultId)
  const nodes = await (await requireRepo()).listNodesPage({ vaultId, notebookId, limit: 400 })
  const peerNameById = new Map(nodes.map((node) => [node.id, node.name]))
  return collectSimilarPendingPairs(nodes, peerNameById)
}

export async function mobileDismissNotebookSimilarPair(input: {
  notebookId: string
  vaultId: string
  nodeId: string
  peerId: string
}): Promise<{ ok: true }> {
  const notebookId = requireNotebookId(input.notebookId)
  const vaultId = requireVaultId(input.vaultId)
  const peerId = input.peerId.trim()
  if (!peerId) return { ok: true }
  const repo = await requireRepo()
  const node = await repo.getNodeById(input.nodeId, vaultId, notebookId)
  if (!node) throw new Error(i18n.t('graph.node_not_found', '节点不存在'))
  const now = Date.now()
  const props = removeSimilarPendingPeerFromProps(parseGraphNodePropsRecord(node.propsJson), peerId)
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
    shardMonth: node.shardMonth,
    createdAt: node.createdAt,
    updatedAt: now,
    deletedAt: null,
    reviewStatus: (node.reviewStatus as 'approved' | 'pending' | 'rejected') || 'approved'
  }
  await createRaw().writeNode(record)
  await syncNotebookGraphIndex(notebookId, vaultId)
  notifyNotebookGraphChanged(notebookId)
  return { ok: true }
}

export async function mobileMergeNotebookGraphNodes(input: {
  notebookId: string
  vaultId: string
  survivorId: string
  loserId: string
}): Promise<{ ok: true }> {
  const notebookId = requireNotebookId(input.notebookId)
  const vaultId = requireVaultId(input.vaultId)
  const survivorId = input.survivorId.trim()
  const loserId = input.loserId.trim()
  if (!survivorId || !loserId || survivorId === loserId) throw new Error('invalid merge pair')
  const repo = await requireRepo()
  const [survivor, loser] = await Promise.all([
    repo.getNodeById(survivorId, vaultId, notebookId),
    repo.getNodeById(loserId, vaultId, notebookId)
  ])
  if (!survivor || !loser) throw new Error(i18n.t('graph.node_not_found', '节点不存在'))
  const now = Date.now()
  const vaultName = await resolveVaultName(vaultId)
  const neighborhood = await repo.getNeighborhood({
    vaultId,
    notebookId,
    nodeId: loserId,
    maxNodes: 5000
  })
  const raw = createRaw()
  for (const edge of neighborhood.edges) {
    if (edge.deletedAt != null) continue
    const fromId = edge.fromId === loserId ? survivorId : edge.fromId
    const toId = edge.toId === loserId ? survivorId : edge.toId
    if (fromId === toId) {
      await raw.writeEdge({
        id: edge.id,
        schemaVersion: 1,
        vaultId,
        vaultName,
        notebookId,
        fromId: edge.fromId,
        toId: edge.toId,
        edgeType: edge.edgeType,
        props: parseGraphNodePropsRecord(edge.propsJson),
        validFrom: edge.validFrom ?? null,
        validTo: edge.validTo ?? null,
        isCurrent: false,
        sourceKind: edge.sourceKind,
        sourceRef: edge.sourceRef,
        sourceExcerpt: edge.sourceExcerpt,
        sourceContentHash: edge.sourceContentHash,
        confidence: edge.confidence,
        origin: edge.origin === 'user' ? 'user' : 'ai',
        reviewStatus: (edge.reviewStatus as 'approved' | 'pending' | 'rejected') || 'approved',
        shardMonth: edge.shardMonth,
        createdAt: edge.createdAt,
        updatedAt: now,
        deletedAt: now
      })
      continue
    }
    await raw.writeEdge({
      id: edge.id,
      schemaVersion: 1,
      vaultId,
      vaultName,
      notebookId,
      fromId,
      toId,
      edgeType: edge.edgeType,
      props: parseGraphNodePropsRecord(edge.propsJson),
      validFrom: edge.validFrom ?? null,
      validTo: edge.validTo ?? null,
      isCurrent: edge.isCurrent === 1,
      sourceKind: edge.sourceKind,
      sourceRef: edge.sourceRef,
      sourceExcerpt: edge.sourceExcerpt,
      sourceContentHash: edge.sourceContentHash,
      confidence: edge.confidence,
      origin: edge.origin === 'user' ? 'user' : 'ai',
      reviewStatus: (edge.reviewStatus as 'approved' | 'pending' | 'rejected') || 'approved',
      shardMonth: edge.shardMonth,
      createdAt: edge.createdAt,
      updatedAt: now,
      deletedAt: null
    })
  }
  const aliases = [
    ...new Set(
      [...parseAliases(survivor.aliases), ...parseAliases(loser.aliases), loser.name].filter(
        Boolean
      )
    )
  ]
  await raw.writeNode({
    id: survivor.id,
    schemaVersion: 1,
    vaultId,
    vaultName,
    notebookId,
    nodeType: survivor.nodeType,
    name: survivor.name,
    discriminator: survivor.discriminator ?? '',
    aliases,
    summary: survivor.summary || loser.summary || '',
    props: removeSimilarPendingPeerFromProps(
      parseGraphNodePropsRecord(survivor.propsJson),
      loserId
    ),
    mentionCount: (survivor.mentionCount || 0) + (loser.mentionCount || 0),
    firstSeenAt: Math.min(survivor.firstSeenAt ?? now, loser.firstSeenAt ?? now),
    lastSeenAt: Math.max(survivor.lastSeenAt ?? now, loser.lastSeenAt ?? now),
    origin: survivor.origin === 'user' || loser.origin === 'user' ? 'user' : 'ai',
    shardMonth: survivor.shardMonth,
    createdAt: survivor.createdAt,
    updatedAt: now,
    deletedAt: null,
    reviewStatus: (survivor.reviewStatus as 'approved' | 'pending' | 'rejected') || 'approved'
  })
  await raw.writeNode({
    id: loser.id,
    schemaVersion: 1,
    vaultId,
    vaultName,
    notebookId,
    nodeType: loser.nodeType,
    name: loser.name,
    discriminator: loser.discriminator ?? '',
    aliases: parseAliases(loser.aliases),
    summary: loser.summary || '',
    props: parseGraphNodePropsRecord(loser.propsJson),
    mentionCount: loser.mentionCount,
    firstSeenAt: loser.firstSeenAt ?? now,
    lastSeenAt: loser.lastSeenAt ?? now,
    origin: loser.origin === 'user' ? 'user' : 'ai',
    shardMonth: loser.shardMonth,
    createdAt: loser.createdAt,
    updatedAt: now,
    deletedAt: now,
    reviewStatus: (loser.reviewStatus as 'approved' | 'pending' | 'rejected') || 'approved'
  })
  await syncNotebookGraphIndex(notebookId, vaultId)
  notifyNotebookGraphChanged(notebookId)
  return { ok: true }
}
