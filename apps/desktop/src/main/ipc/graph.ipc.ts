import { ipcMain } from 'electron'
import * as nodePath from 'node:path'
import {
  GraphLlmExtractionService,
  GraphSyncService,
  createDefaultGraphExtractLlm,
  estimateExtractionCost,
  mergeDiaryGraphNodeGroup,
  mergeDiaryGraphNodes,
  applyDiaryGraphSurgicalDelete,
  syncDiaryGraphMergeGroupIntoIndex,
  syncDiaryGraphMergeIntoIndex,
  type GraphEdgeRawRecord,
  type GraphExtractDraft,
  type GraphNodeRawRecord
} from '@baishou/core-desktop'
import {
  connectionManager,
  GraphRepository,
  GRAPH_EDGE_TYPES,
  GRAPH_NODE_TYPES,
  UserProfileRepository
} from '@baishou/database-desktop'
import {
  GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR,
  GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR,
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  buildGraphExtractEnqueueItems,
  logger,
  resolveGlobalGraphModelIds,
  resolveGraphExtractConcurrency,
  resolveGraphExtractSelfName,
  graphDiaryInstant,
  graphEdgeId,
  graphNodeIdForEntity,
  graphSameNameExistingFromRow,
  GRAPH_GLOBAL_MAX_NODES,
  expandApprovedGraphReviewEdgeIds,
  isGraphReviewStatus,
  uniqueNonEmptyIds,
  type GlobalModelsConfig,
  type GraphSetReviewsBatchInput
} from '@baishou/shared'
import {
  fileSystem,
  pathService,
  vaultService,
  resolveActiveVaultId,
  resolveVaultNameById
} from './vault.ipc'
import {
  ensureRawDataRuntime,
  getDerivedFreshness,
  getGraphRawManager,
  syncGraphPendingIndex
} from '../services/raw-data-source.runtime'
import { getActiveProvider } from './agent-helpers'
import { GraphExtractQueueService } from '../services/graph-extract-queue.service'
import { resolveDesktopGraphExtractAlignDeps } from '../services/graph-extract-embed-gate'

function requireVaultName(): string {
  return vaultService.getActiveVault()?.name || 'Personal'
}

function requireVaultId(): string {
  return resolveActiveVaultId()
}

function requireGraphRepo(): GraphRepository {
  if (!connectionManager.isConnected()) {
    throw new Error('Agent database not connected')
  }
  return new GraphRepository(connectionManager.getDb())
}

async function resolveExtractLlm() {
  const { settingsManager } = await import('./settings.ipc')
  const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
  const { providerId, modelId } = resolveGlobalGraphModelIds(globalModels)
  const provider = await getActiveProvider(providerId)
  return createDefaultGraphExtractLlm({ provider, modelId })
}

async function buildExtractionService(): Promise<GraphLlmExtractionService> {
  const { graphManager, freshness } = ensureRawDataRuntime()
  const repo = requireGraphRepo()
  const llm = await resolveExtractLlm()
  let embedder: { embedQuery?: (text: string) => Promise<number[] | null>; modelId?: string } | null =
    null
  try {
    const { resolveEmbeddingSystemModels } = await import('./agent-helpers')
    const { EmbeddingAdapter } = await import('@baishou/ai')
    const { createSqlExecutorFromDrizzleDb, SqliteHybridSearchRepository } = await import(
      '@baishou/database-desktop'
    )
    const { embeddingProvider, embeddingModelId } = await resolveEmbeddingSystemModels()
    if (embeddingProvider && embeddingModelId && connectionManager.isConnected()) {
      const hsRepo = new SqliteHybridSearchRepository(
        createSqlExecutorFromDrizzleDb(connectionManager.getDb())
      )
      const adapter = new EmbeddingAdapter(embeddingProvider, embeddingModelId, hsRepo)
      if (adapter.isConfigured) {
        embedder = {
          embedQuery: (text) => adapter.embedQuery(text),
          modelId: adapter.embeddingModelId
        }
      }
    }
  } catch {
    embedder = null
  }
  const graphSync = new GraphSyncService(graphManager, repo, embedder)
  const alignDeps = await resolveDesktopGraphExtractAlignDeps(requireVaultId())
  return new GraphLlmExtractionService(
    graphManager,
    freshness,
    repo,
    graphSync,
    pathService,
    fileSystem,
    llm,
    {
      embedQuery: alignDeps.embedQuery ?? embedder?.embedQuery,
      modelId: alignDeps.modelId ?? embedder?.modelId,
      isEmbeddingConfigured: alignDeps.isEmbeddingConfigured,
      isDiaryEmbedded: alignDeps.isDiaryEmbedded
    }
  )
}

function parseProps(propsJson: string | null | undefined): Record<string, unknown> {
  try {
    return JSON.parse(propsJson || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

/** Prefer record vaultId; never fall back to name-derived id (random-id vaults). */
function writeVaultId(recordVaultId: string | null | undefined): string {
  return recordVaultId?.trim() || requireVaultId()
}

async function writeNodeReview(
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

async function writeEdgeReview(
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

async function applyGraphReviews(
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

async function resolveExtractSelfName(): Promise<string> {
  const { settingsManager } = await import('./settings.ipc')
  const flag = await settingsManager.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)
  if (!connectionManager.isConnected()) {
    throw new Error(GRAPH_SELF_NAME_REQUIRED_ERROR)
  }
  const profile = await new UserProfileRepository(connectionManager.getDb()).getProfile()
  const selfName = resolveGraphExtractSelfName(flag === true, profile?.nickname)
  if (!selfName) {
    throw new Error(GRAPH_SELF_NAME_REQUIRED_ERROR)
  }
  return selfName
}

async function enqueueGraphExtract(
  extractQueue: GraphExtractQueueService,
  opts?: { filePaths?: string[]; concurrency?: number }
): Promise<{ queued: number; totalPending: number; skippedNotEmbedded: string[] }> {
  await resolveExtractSelfName()
  if (opts?.concurrency != null) {
    extractQueue.setConcurrency(opts.concurrency)
  }
  const vaultId = requireVaultId()
  const alignDeps = await resolveDesktopGraphExtractAlignDeps(vaultId)
  if (!(await alignDeps.isEmbeddingConfigured?.())) {
    throw new Error(GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR)
  }
  const pending = await getDerivedFreshness().listPendingReextract()
  const wanted = opts?.filePaths?.length ? opts.filePaths : pending.map((p) => p.filePath)
  const { items, skippedNotEmbedded } = await buildGraphExtractEnqueueItems({
    wanted,
    pending,
    isDiaryEmbedded: alignDeps.isDiaryEmbedded
  })
  const queued = extractQueue.enqueue(items)
  return { queued, totalPending: items.length, skippedNotEmbedded }
}

export function registerGraphIPC(): void {
  ipcMain.handle('graph:list-pending-reextract', async () => {
    ensureRawDataRuntime()
    return getDerivedFreshness().listPendingReextract()
  })

  ipcMain.handle('graph:list-pending-index', async () => {
    const { graphManager } = ensureRawDataRuntime()
    return graphManager.listPendingIndex()
  })

  ipcMain.handle('graph:estimate-extraction', async () => {
    ensureRawDataRuntime()
    const pending = await getDerivedFreshness().listPendingReextract()
    const vault = await pathService.getActiveVaultPath()
    const charCounts: number[] = []
    if (vault) {
      for (const item of pending) {
        try {
          const full = nodePath.join(vault, item.filePath.replace(/^[/\\]+/, ''))
          const text = await fileSystem.readFile(full, 'utf8')
          charCounts.push(typeof text === 'string' ? text.length : 0)
        } catch {
          charCounts.push(0)
        }
      }
    }
    return estimateExtractionCost(pending.length, { charCounts })
  })

  // Background extract queue (leave Graph page OK; restart loses in-flight).
  const extractQueue = GraphExtractQueueService.getInstance()
  extractQueue.setFlushDrafts(async (items, signal, onPhase) => {
    const service = await buildExtractionService()
    return service.commitDrafts(
      items.map((item) => item.draft as GraphExtractDraft),
      signal,
      onPhase
    )
  })
  extractQueue.setRunner(async ({ filePath, signal, onProgress }) => {
    const vaultName = requireVaultName()
    const selfName = await resolveExtractSelfName()
    const service = await buildExtractionService()
    const draft = await service.extractDraft({
      vaultId: requireVaultId(),
      vaultName,
      selfName,
      filePath,
      signal,
      onProgress
    })
    return { done: 1, failed: 0, errors: [], draft }
  })

  ipcMain.handle('graph:get-queue-state', async () => extractQueue.getQueueState())

  ipcMain.handle('graph:stop-extract', async () => {
    extractQueue.stop()
    return { ok: true }
  })

  ipcMain.handle('graph:cancel-queue-item', async (_e, opts: { filePath: string }) => {
    return { ok: extractQueue.cancelItem(opts?.filePath) }
  })

  // Alias for older clients
  ipcMain.handle('graph:extract-cancel', async () => {
    extractQueue.stop()
    return { ok: true }
  })

  ipcMain.handle(
    'graph:set-extract-concurrency',
    async (_e, opts?: { concurrency?: number }) => {
      const concurrency = resolveGraphExtractConcurrency(opts?.concurrency)
      extractQueue.setConcurrency(concurrency)
      return { concurrency }
    }
  )

  ipcMain.handle('graph:queue-extract', async (_e, opts?: { filePaths?: string[]; concurrency?: number }) => {
    return enqueueGraphExtract(extractQueue, opts)
  })

  /**
   * Backward-compatible: enqueue and return immediately (no longer blocks until batch done).
   * Prefer graph:queue-extract + graph:queue-progress.
   */
  ipcMain.handle('graph:extract', async (_e, opts?: { filePaths?: string[]; concurrency?: number }) => {
    const result = await enqueueGraphExtract(extractQueue, opts)
    return {
      done: 0,
      failed: result.skippedNotEmbedded.length,
      queued: result.queued,
      skippedNotEmbedded: result.skippedNotEmbedded,
      errors: result.skippedNotEmbedded.map((filePath) => ({
        filePath,
          message: GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR
      }))
    }
  })

  ipcMain.handle(
    'graph:get-global-graph',
    async (
      _e,
      opts?: {
        maxNodes?: number
        minMentionCount?: number
        nodeTypes?: string[]
        monthRange?: { startMonth: string; endMonth: string }
      }
    ) => {
      const repo = requireGraphRepo()
      return repo.getGlobalGraph({
        vaultId: requireVaultId(),
        maxNodes: opts?.maxNodes ?? GRAPH_GLOBAL_MAX_NODES,
        minMentionCount: opts?.minMentionCount ?? 0,
        nodeTypes: opts?.nodeTypes,
        monthRange: opts?.monthRange
      })
    }
  )

  ipcMain.handle(
    'graph:get-view',
    async (_e, opts: { centerNodeId: string; depth?: 1 | 2 | 3 }) => {
      const repo = requireGraphRepo()
      const depth = opts.depth === 3 ? 3 : opts.depth === 1 ? 1 : 2
      return repo.traverse(requireVaultId(), opts.centerNodeId, depth)
    }
  )

  ipcMain.handle(
    'graph:find-paths',
    async (_e, opts: { fromId: string; toId: string; maxHops?: 2 | 3 }) => {
      const repo = requireGraphRepo()
      const path = await repo.findShortestPath(requireVaultId(), opts.fromId, opts.toId, {
        maxHops: opts.maxHops ?? 3,
        approvedOnly: true
      })
      return path
    }
  )

  ipcMain.handle(
    'graph:search',
    async (_e, opts: { query: string; nodeTypes?: string[]; limit?: number }) => {
      const repo = requireGraphRepo()
      return repo.searchNodesByName(requireVaultId(), opts.query, {
        nodeTypes: opts.nodeTypes,
        limit: opts.limit ?? 20
      })
    }
  )

  ipcMain.handle(
    'graph:find-by-name',
    async (_e, opts: { query: string; nodeType?: string }) => {
      const repo = requireGraphRepo()
      const hit = await repo.findNodeByNameOrAlias(
        requireVaultId(),
        opts.query,
        opts.nodeType
      )
      if (!hit) return null
      return {
        id: hit.id,
        name: hit.name,
        nodeType: hit.nodeType,
        summary: hit.summary ?? '',
        aliases: hit.aliases ?? []
      }
    }
  )

  ipcMain.handle('graph:list-pending-edges', async () => {
    const repo = requireGraphRepo()
    return repo.listPendingEdges(requireVaultId())
  })

  ipcMain.handle('graph:list-pending', async () => {
    const repo = requireGraphRepo()
    const vaultId = requireVaultId()
    const [nodes, edges] = await Promise.all([
      repo.listPendingNodes(vaultId),
      repo.listPendingEdges(vaultId)
    ])
    return { nodes, edges }
  })

  ipcMain.handle(
    'graph:set-edge-review',
    async (_e, opts: { edgeId: string; reviewStatus: 'approved' | 'rejected' }) => {
      await writeEdgeReview(opts.edgeId, opts.reviewStatus, { approvePendingEndpoints: true })
      await syncGraphPendingIndex()
      return { ok: true }
    }
  )

  ipcMain.handle(
    'graph:set-node-review',
    async (_e, opts: { nodeId: string; reviewStatus: 'approved' | 'rejected' }) => {
      await writeNodeReview(opts.nodeId, opts.reviewStatus)
      await syncGraphPendingIndex()
      return { ok: true }
    }
  )

  ipcMain.handle('graph:set-reviews-batch', async (_e, opts: GraphSetReviewsBatchInput) => {
    return applyGraphReviews(opts ?? { reviewStatus: 'approved' })
  })

  ipcMain.handle(
    'graph:upsert-node',
    async (
      _e,
      input: {
        id?: string
        name: string
        nodeType: string
        aliases?: string[]
        summary?: string
      }
    ) => {
      const vaultName = requireVaultName()
      const repo = requireGraphRepo()
      const now = Date.now()
      const nodeType = GRAPH_NODE_TYPES.includes(input.nodeType as never) ? input.nodeType : 'topic'
      const existing = input.id ? await repo.getNodeById(input.id, requireVaultId()) : null
      const name = input.name.trim()
      const aliases = Array.isArray(input.aliases) ? input.aliases : (existing?.aliases ?? [])
      const vaultId = writeVaultId(existing?.vaultId)
      const shardMonth =
        existing?.shardMonth || graphDiaryInstant(null, now).shardMonth
      if (nodeType === 'entry' && !existing?.id && !input.id) {
        throw new Error('entry 节点必须基于日记路径，不能手建随机 id')
      }
      const sameName = graphSameNameExistingFromRow(
        await repo.findNodeByNameOrAlias(vaultId, name, existing?.nodeType || nodeType),
        existing?.id || input.id
      )
      if (sameName) {
        return { conflict: 'same-name' as const, existing: sameName }
      }
      const record: GraphNodeRawRecord = {
        id: existing?.id || input.id || graphNodeIdForEntity(vaultId, nodeType, name),
        schemaVersion: 1,
        vaultId,
        vaultName: resolveVaultNameById(vaultId) || vaultName,
        nodeType: existing?.nodeType || nodeType,
        name,
        aliases,
        summary: input.summary ?? existing?.summary ?? '',
        props: existing ? parseProps(existing.propsJson) : {},
        mentionCount: existing?.mentionCount ?? 0,
        firstSeenAt: existing?.firstSeenAt ?? now,
        lastSeenAt: now,
        // User edits always set origin=user so re-extract will not supersede them.
        origin: 'user',
        shardMonth,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
        reviewStatus: 'approved'
      }
      await getGraphRawManager().writeRecord(record, { collection: 'nodes' })
      await syncGraphPendingIndex()
      return { id: record.id }
    }
  )

  ipcMain.handle(
    'graph:upsert-edge',
    async (
      _e,
      input: {
        id?: string
        fromId: string
        toId: string
        edgeType: string
        sourceRef?: string
        sourceExcerpt?: string
      }
    ) => {
      const vaultName = requireVaultName()
      const vaultId = requireVaultId()
      const now = Date.now()
      const diary = graphDiaryInstant(input.sourceRef ?? null, now)
      const shardMonth = diary.shardMonth
      const edgeType = GRAPH_EDGE_TYPES.includes(input.edgeType as never)
        ? input.edgeType
        : 'relates_to'
      const sourceRef = input.sourceRef ?? null
      const record: GraphEdgeRawRecord = {
        id:
          input.id ||
          graphEdgeId(vaultId, input.fromId, input.toId, edgeType, sourceRef),
        schemaVersion: 1,
        vaultId,
        vaultName,
        fromId: input.fromId,
        toId: input.toId,
        edgeType,
        props: {},
        validFrom: diary.validFrom ?? now,
        validTo: null,
        isCurrent: true,
        sourceKind: 'manual',
        sourceRef,
        sourceExcerpt: input.sourceExcerpt ?? '',
        sourceContentHash: null,
        confidence: 100,
        origin: 'user',
        reviewStatus: 'approved',
        shardMonth,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }
      await getGraphRawManager().writeRecord(record, { collection: 'edges' })
      await syncGraphPendingIndex()
      return { id: record.id }
    }
  )

  ipcMain.handle('graph:soft-delete', async (_e, opts: { kind: 'node' | 'edge'; id: string }) => {
    const manager = getGraphRawManager()
    const repo = requireGraphRepo()
    await applyDiaryGraphSurgicalDelete({
      kind: opts.kind,
      id: opts.id,
      vaultId: requireVaultId(),
      manager,
      repo
    })
    return { ok: true }
  })

  ipcMain.handle(
    'graph:merge-nodes',
    async (_e, opts: { survivorId: string; loserId: string; reason?: string }) => {
      const manager = getGraphRawManager()
      const repo = requireGraphRepo()
      const result = await mergeDiaryGraphNodes({
        vaultId: requireVaultId(),
        vaultName: requireVaultName(),
        survivorId: opts.survivorId,
        loserId: opts.loserId,
        reason: opts.reason,
        manager,
        repo
      })
      await syncDiaryGraphMergeIntoIndex({
        loserId: result.loserId,
        syncPendingIndex: syncGraphPendingIndex,
        softDeleteNode: (id) => repo.softDeleteNode(id)
      })
      return { ok: true, ...result }
    }
  )

  ipcMain.handle(
    'graph:merge-nodes-batch',
    async (_e, opts: { survivorId: string; loserIds: string[]; reason?: string }) => {
      const manager = getGraphRawManager()
      const repo = requireGraphRepo()
      const result = await mergeDiaryGraphNodeGroup({
        vaultId: requireVaultId(),
        vaultName: requireVaultName(),
        survivorId: opts.survivorId,
        loserIds: opts.loserIds,
        reason: opts.reason,
        manager,
        repo
      })
      await syncDiaryGraphMergeGroupIntoIndex({
        loserIds: result.loserIds,
        syncPendingIndex: syncGraphPendingIndex,
        softDeleteNode: (id) => repo.softDeleteNode(id)
      })
      return { ok: true, ...result }
    }
  )

  ipcMain.handle('graph:get-node', async (_e, id: string) => {
    return requireGraphRepo().getNodeById(id)
  })

  ipcMain.handle('graph:meta', async () => ({
    nodeTypes: [...GRAPH_NODE_TYPES],
    edgeTypes: [...GRAPH_EDGE_TYPES]
  }))

  logger.info('[GraphIPC] Graph IPC registered')
}
