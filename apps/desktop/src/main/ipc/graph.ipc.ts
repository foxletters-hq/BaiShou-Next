import { ipcMain } from 'electron'
import {
  GraphLlmExtractionService,
  GraphSyncService,
  createDefaultGraphExtractLlm,
  type GraphEdgeRawRecord,
  type GraphNodeRawRecord
} from '@baishou/core-desktop'
import {
  connectionManager,
  GraphRepository,
  GRAPH_EDGE_TYPES,
  GRAPH_NODE_TYPES
} from '@baishou/database-desktop'
import {
  logger,
  resolveGlobalGraphModelIds,
  type GlobalModelsConfig
} from '@baishou/shared'
import { fileSystem, pathService, vaultService } from './vault.ipc'
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

export function registerGraphIPC(): void {
  ipcMain.handle('graph:list-pending-reextract', async () => {
    ensureRawDataRuntime()
    return getDerivedFreshness().listPendingReextract()
  })

  ipcMain.handle('graph:list-pending-index', async () => {
    const { graphManager } = ensureRawDataRuntime()
    return graphManager.listPendingIndex()
  })

  ipcMain.handle(
    'graph:extract',
    async (_e, opts?: { filePaths?: string[] }) => {
      const vaultName = requireVaultName()
      const service = await buildExtractionService()
      return service.extractDiaries({
        vaultName,
        filePaths: opts?.filePaths
      })
    }
  )

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
        vaultName: requireVaultName(),
        maxNodes: opts?.maxNodes ?? 200,
        minMentionCount: opts?.minMentionCount ?? 0,
        nodeTypes: opts?.nodeTypes
      })
    }
  )

  ipcMain.handle(
    'graph:get-view',
    async (_e, opts: { centerNodeId: string; depth?: 1 | 2 }) => {
      const repo = requireGraphRepo()
      return repo.traverse(requireVaultName(), opts.centerNodeId, opts.depth ?? 2)
    }
  )

  ipcMain.handle(
    'graph:search',
    async (_e, opts: { query: string; nodeTypes?: string[]; limit?: number }) => {
      const repo = requireGraphRepo()
      return repo.searchNodesByName(requireVaultName(), opts.query, {
        nodeTypes: opts.nodeTypes,
        limit: opts.limit ?? 20
      })
    }
  )

  ipcMain.handle('graph:list-pending-edges', async () => {
    const repo = requireGraphRepo()
    return repo.listPendingEdges(requireVaultName())
  })

  ipcMain.handle(
    'graph:set-edge-review',
    async (_e, opts: { edgeId: string; reviewStatus: 'approved' | 'rejected' }) => {
      const repo = requireGraphRepo()
      const edge = await repo.getEdgeById(opts.edgeId)
      if (!edge) throw new Error(`Edge not found: ${opts.edgeId}`)
      const now = Date.now()
      const record: GraphEdgeRawRecord = {
        id: edge.id,
        schemaVersion: 1,
        vaultName: edge.vaultName,
        fromId: edge.fromId,
        toId: edge.toId,
        edgeType: edge.edgeType,
        props: (() => {
          try {
            return JSON.parse(edge.propsJson || '{}') as Record<string, unknown>
          } catch {
            return {}
          }
        })(),
        validFrom: edge.validFrom,
        validTo: edge.validTo,
        isCurrent: opts.reviewStatus === 'rejected' ? false : edge.isCurrent,
        sourceKind: edge.sourceKind,
        sourceRef: edge.sourceRef,
        sourceExcerpt: edge.sourceExcerpt,
        sourceContentHash: edge.sourceContentHash,
        confidence: edge.confidence,
        origin: edge.origin as 'ai' | 'user',
        reviewStatus: opts.reviewStatus,
        shardMonth: edge.shardMonth,
        createdAt: edge.createdAt,
        updatedAt: now,
        deletedAt: opts.reviewStatus === 'rejected' ? now : edge.deletedAt
      }
      await getGraphRawManager().writeRecord(record, { collection: 'edges' })
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
      const nodeType = GRAPH_NODE_TYPES.includes(input.nodeType as never)
        ? input.nodeType
        : 'topic'
      const existing = input.id ? await repo.getNodeById(input.id) : null
      const name = input.name.trim()
      const aliases = Array.isArray(input.aliases)
        ? input.aliases
        : (existing?.aliases ?? [])
      const record: GraphNodeRawRecord = {
        id: existing?.id || input.id || newId('n'),
        schemaVersion: 1,
        vaultName,
        nodeType: existing?.nodeType || nodeType,
        name,
        aliases,
        summary: input.summary ?? existing?.summary ?? '',
        props: (() => {
          try {
            return existing ? (JSON.parse(existing.propsJson || '{}') as Record<string, unknown>) : {}
          } catch {
            return {}
          }
        })(),
        mentionCount: existing?.mentionCount ?? 1,
        firstSeenAt: existing?.firstSeenAt ?? now,
        lastSeenAt: now,
        origin: (existing?.origin as 'ai' | 'user') || 'user',
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
      const now = Date.now()
      const d = new Date(now)
      const shardMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const edgeType = GRAPH_EDGE_TYPES.includes(input.edgeType as never)
        ? input.edgeType
        : 'relates_to'
      const record: GraphEdgeRawRecord = {
        id: input.id || newId('e'),
        schemaVersion: 1,
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

  ipcMain.handle(
    'graph:soft-delete',
    async (_e, opts: { kind: 'node' | 'edge'; id: string }) => {
      const manager = getGraphRawManager()
      await manager.tombstone(opts.id, {
        collection: opts.kind === 'node' ? 'nodes' : 'edges'
      })
      await syncGraphPendingIndex()
      return { ok: true }
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
