import { ipcMain } from 'electron'
import * as nodePath from 'node:path'
import {
  GraphLlmExtractionService,
  GraphSyncService,
  createDefaultGraphExtractLlm,
  estimateExtractionCost,
  type GraphEdgeRawRecord,
  type GraphNodeRawRecord
} from '@baishou/core-desktop'
import {
  connectionManager,
  GraphRepository,
  GRAPH_EDGE_TYPES,
  GRAPH_NODE_TYPES
} from '@baishou/database-desktop'
import { logger, resolveGlobalGraphModelIds, type GlobalModelsConfig } from '@baishou/shared'
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
  const graphSync = new GraphSyncService(graphManager, repo, null)
  return new GraphLlmExtractionService(
    graphManager,
    freshness,
    repo,
    graphSync,
    pathService,
    fileSystem,
    llm
  )
}

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
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
    createdAt: node.createdAt,
    updatedAt: now,
    deletedAt: reviewStatus === 'rejected' ? now : node.deletedAt,
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
    deletedAt: reviewStatus === 'rejected' ? now : edge.deletedAt
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

  // Active extract abort controller (single in-flight batch).
  let extractAbort: AbortController | null = null

  ipcMain.handle('graph:extract-cancel', async () => {
    extractAbort?.abort()
    return { ok: true }
  })

  ipcMain.handle('graph:extract', async (event, opts?: { filePaths?: string[] }) => {
    const vaultName = requireVaultName()
    const service = await buildExtractionService()
    extractAbort?.abort()
    extractAbort = new AbortController()
    const signal = extractAbort.signal
    try {
      return await service.extractDiaries({
        vaultId: requireVaultId(),
        vaultName,
        filePaths: opts?.filePaths,
        signal,
        onProgress: (p) => {
          try {
            event.sender.send('graph:extract-progress', p)
          } catch {
            // sender may be gone
          }
        }
      })
    } finally {
      if (extractAbort?.signal === signal) extractAbort = null
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
      }
    ) => {
      const repo = requireGraphRepo()
      return repo.getGlobalGraph({
        vaultId: requireVaultId(),
        maxNodes: opts?.maxNodes ?? 200,
        minMentionCount: opts?.minMentionCount ?? 0,
        nodeTypes: opts?.nodeTypes
      })
    }
  )

  ipcMain.handle('graph:get-view', async (_e, opts: { centerNodeId: string; depth?: 1 | 2 }) => {
    const repo = requireGraphRepo()
    return repo.traverse(requireVaultId(), opts.centerNodeId, opts.depth ?? 2)
  })

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
      const record: GraphNodeRawRecord = {
        id: existing?.id || input.id || newId('n'),
        schemaVersion: 1,
        vaultId,
        vaultName: resolveVaultNameById(vaultId) || vaultName,
        nodeType: existing?.nodeType || nodeType,
        name,
        aliases,
        summary: input.summary ?? existing?.summary ?? '',
        props: existing ? parseProps(existing.propsJson) : {},
        mentionCount: existing?.mentionCount ?? 1,
        firstSeenAt: existing?.firstSeenAt ?? now,
        lastSeenAt: now,
        // User edits always set origin=user so re-extract will not supersede them.
        origin: 'user',
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
      const d = new Date(now)
      const shardMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const edgeType = GRAPH_EDGE_TYPES.includes(input.edgeType as never)
        ? input.edgeType
        : 'relates_to'
      const record: GraphEdgeRawRecord = {
        id: input.id || newId('e'),
        schemaVersion: 1,
        vaultId,
        vaultName,
        fromId: input.fromId,
        toId: input.toId,
        edgeType,
        props: {},
        validFrom: now,
        validTo: null,
        isCurrent: true,
        sourceKind: 'manual',
        sourceRef: input.sourceRef ?? null,
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
    await manager.tombstone(opts.id, {
      collection: opts.kind === 'node' ? 'nodes' : 'edges'
    })
    await syncGraphPendingIndex()
    return { ok: true }
  })

  ipcMain.handle('graph:get-node', async (_e, id: string) => {
    return requireGraphRepo().getNodeById(id)
  })

  ipcMain.handle('graph:meta', async () => ({
    nodeTypes: [...GRAPH_NODE_TYPES],
    edgeTypes: [...GRAPH_EDGE_TYPES]
  }))

  logger.info('[GraphIPC] Graph IPC registered')
}
