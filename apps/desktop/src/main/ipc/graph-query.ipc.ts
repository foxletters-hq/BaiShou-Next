import { ipcMain } from 'electron'
import { GRAPH_EDGE_TYPES, GRAPH_NODE_TYPES } from '@baishou/database-desktop'
import {
  GRAPH_GLOBAL_MAX_NODES,
  GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR,
  normalizeGraphFilePath,
  resolveGraphSearchMode
} from '@baishou/shared'
import { getActiveVaultShadowRepo } from './vault.ipc'
import { resolveGraphQueryEmbedder } from './graph-extract.runtime'
import { requireGraphRepo, requireVaultId } from './graph-ipc.context'

export function registerGraphQueryIpc(): void {
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
    async (_e, opts: { query: string; nodeTypes?: string[]; limit?: number; mode?: string }) => {
      const repo = requireGraphRepo()
      const vaultId = requireVaultId()
      const limit = opts.limit ?? 20
      const mode = resolveGraphSearchMode(opts.mode)
      if (mode !== 'semantic') {
        return repo.searchNodesByName(vaultId, opts.query, {
          nodeTypes: opts.nodeTypes,
          limit
        })
      }
      const embedder = await resolveGraphQueryEmbedder()
      if (!embedder) {
        throw new Error(GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR)
      }
      const vector = await embedder.embedQuery(opts.query)
      if (!vector?.length) return []
      const typeFilter =
        opts.nodeTypes && opts.nodeTypes.length > 0 ? new Set(opts.nodeTypes) : null
      const hits = await repo.searchNodesByVector(vaultId, vector, limit, {
        modelId: embedder.modelId,
        nodeType: opts.nodeTypes?.length === 1 ? opts.nodeTypes[0] : undefined
      })
      return hits
        .filter((row) => row.reviewStatus !== 'rejected')
        .filter((row) => !typeFilter || typeFilter.has(row.nodeType))
        .map(({ distance: _distance, ...row }) => row)
    }
  )

  ipcMain.handle('graph:find-by-name', async (_e, opts: { query: string; nodeType?: string }) => {
    const repo = requireGraphRepo()
    const hits = await repo.findNodesByNameOrAlias(requireVaultId(), opts.query, opts.nodeType)
    const hit = hits[0]
    if (!hit) return null
    return {
      id: hit.id,
      name: hit.name,
      nodeType: hit.nodeType,
      summary: hit.summary ?? '',
      aliases: hit.aliases ?? [],
      discriminator: hit.discriminator ?? ''
    }
  })

  ipcMain.handle('graph:list-pending-edges', async () => {
    const repo = requireGraphRepo()
    return repo.listPendingEdges(requireVaultId())
  })

  ipcMain.handle('graph:list-pending', async () => {
    return requireGraphRepo().listPendingGraph(requireVaultId())
  })

  ipcMain.handle('graph:list-suspect-nodes', async () => {
    return requireGraphRepo().listSuspectNodes(requireVaultId())
  })

  ipcMain.handle('graph:list-similar-pairs', async () => {
    return requireGraphRepo().listSimilarPendingPairs(requireVaultId())
  })

  ipcMain.handle('graph:get-node', async (_e, id: string) => {
    return requireGraphRepo().getNodeById(id)
  })

  ipcMain.handle('graph:meta', async () => ({
    nodeTypes: [...GRAPH_NODE_TYPES],
    edgeTypes: [...GRAPH_EDGE_TYPES]
  }))

  ipcMain.handle('graph:resolve-journal', async (_e, opts?: { date?: string }) => {
    const date = String(opts?.date || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
    const shadow = await getActiveVaultShadowRepo().findByDate(date)
    const filePath = normalizeGraphFilePath(String(shadow?.filePath || ''))
    if (!filePath) return null
    return { filePath, date }
  })
}
