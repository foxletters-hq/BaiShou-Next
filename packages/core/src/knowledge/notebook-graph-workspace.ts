import {
  notebookGraphNodeIdForEntity,
  type NotebookGraphEdgeRawRecord,
  type NotebookGraphNodeRawRecord
} from '@baishou/shared'
import {
  mergeDiaryGraphNodeGroup,
  mergeDiaryGraphNodes,
  type GraphMergeLookup,
  type GraphMergeRawWriter
} from '../graph/graph-merge-nodes'
import type { GraphWorkspaceIdentity } from '../graph/graph-workspace.types'

export const NOTEBOOK_GRAPH_FORBIDDEN_ANCHOR_TYPES = ['source'] as const

export type NotebookGraphMergeNodeRow = {
  id: string
  vaultId: string
  nodeType: string
  name: string
  aliases?: string | string[] | null
  summary?: string | null
  propsJson?: string | null
  mentionCount: number
  firstSeenAt: number | null
  lastSeenAt: number | null
  origin: string
  shardMonth: string
  reviewStatus?: string | null
  createdAt: number
}

export type NotebookGraphMergeEdgeRow = {
  id: string
  vaultId: string
  fromId: string
  toId: string
  edgeType: string
  propsJson?: string | null
  validFrom: number | null
  validTo: number | null
  isCurrent: number | boolean
  sourceKind: string
  sourceRef: string | null
  sourceExcerpt: string
  sourceContentHash: string | null
  confidence: number
  origin: string
  reviewStatus: string
  shardMonth: string
  createdAt: number
}

export type NotebookGraphMergeRepo = {
  getNodeById(
    id: string,
    vaultId: string,
    notebookId: string
  ): Promise<NotebookGraphMergeNodeRow | null>
  listEdgesTouching(
    vaultId: string,
    notebookId: string,
    nodeId: string
  ): Promise<NotebookGraphMergeEdgeRow[]>
}

export type NotebookGraphMergeRaw = {
  writeNode(record: NotebookGraphNodeRawRecord): Promise<void>
  writeEdge(record: NotebookGraphEdgeRawRecord): Promise<void>
  removeRecordsFromShard(
    notebookId: string,
    collection: 'nodes' | 'edges',
    shardKey: string,
    ids: readonly string[]
  ): Promise<number>
}

function parseAliases(raw: string | string[] | null | undefined): string[] {
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

export function createNotebookGraphIdentity(input: {
  vaultId: string
  notebookId: string
}): GraphWorkspaceIdentity {
  const vaultId = input.vaultId.trim()
  const notebookId = input.notebookId.trim()
  if (!vaultId || !notebookId) {
    throw new Error('createNotebookGraphIdentity: vaultId and notebookId required')
  }
  return {
    kind: 'notebook',
    forbiddenAnchorTypes: NOTEBOOK_GRAPH_FORBIDDEN_ANCHOR_TYPES,
    nodeIdForEntity(type, name, discriminator) {
      return notebookGraphNodeIdForEntity(vaultId, notebookId, type, name, discriminator)
    }
  }
}

export function createNotebookGraphMergeWriter(
  manager: NotebookGraphMergeRaw,
  notebookId: string
): GraphMergeRawWriter {
  const id = notebookId.trim()
  if (!id) throw new Error('createNotebookGraphMergeWriter: notebookId required')
  return {
    async writeRecord(record, opts) {
      const stamped = { ...record, notebookId: id }
      if (opts.collection === 'nodes') {
        await manager.writeNode(stamped as NotebookGraphNodeRawRecord)
        return
      }
      await manager.writeEdge(stamped as NotebookGraphEdgeRawRecord)
    },
    async removeRecordsFromShard(collection, shardMonth, ids) {
      return manager.removeRecordsFromShard(id, collection, shardMonth, ids)
    }
  }
}

export function createNotebookGraphMergeLookup(
  repo: NotebookGraphMergeRepo,
  notebookId: string
): GraphMergeLookup {
  const id = notebookId.trim()
  if (!id) throw new Error('createNotebookGraphMergeLookup: notebookId required')
  return {
    async getNodeById(nodeId, vaultId) {
      const row = await repo.getNodeById(nodeId, vaultId ?? '', id)
      if (!row) return null
      return {
        id: row.id,
        vaultId: row.vaultId,
        nodeType: row.nodeType,
        name: row.name,
        aliases: parseAliases(row.aliases),
        summary: row.summary || '',
        propsJson: row.propsJson ?? undefined,
        mentionCount: row.mentionCount,
        firstSeenAt: row.firstSeenAt,
        lastSeenAt: row.lastSeenAt,
        origin: row.origin,
        shardMonth: row.shardMonth,
        reviewStatus: row.reviewStatus ?? undefined,
        createdAt: row.createdAt
      }
    },
    async listEdgesTouching(vaultId, nodeId) {
      const rows = await repo.listEdgesTouching(vaultId, id, nodeId)
      return rows.map((row) => ({
        id: row.id,
        vaultId: row.vaultId,
        fromId: row.fromId,
        toId: row.toId,
        edgeType: row.edgeType,
        propsJson: row.propsJson ?? undefined,
        validFrom: row.validFrom,
        validTo: row.validTo,
        isCurrent: row.isCurrent === true || row.isCurrent === 1,
        sourceKind: row.sourceKind,
        sourceRef: row.sourceRef,
        sourceExcerpt: row.sourceExcerpt,
        sourceContentHash: row.sourceContentHash,
        confidence: row.confidence,
        origin: row.origin,
        reviewStatus: row.reviewStatus,
        shardMonth: row.shardMonth,
        createdAt: row.createdAt
      }))
    }
  }
}

export async function mergeNotebookGraphNodes(input: {
  vaultId: string
  vaultName: string
  notebookId: string
  survivorId: string
  loserId: string
  reason?: string
  now?: number
  manager: NotebookGraphMergeRaw
  repo: NotebookGraphMergeRepo
}): Promise<{ survivorId: string; loserId: string }> {
  return mergeDiaryGraphNodes({
    vaultId: input.vaultId,
    vaultName: input.vaultName,
    survivorId: input.survivorId,
    loserId: input.loserId,
    reason: input.reason,
    now: input.now,
    forbiddenAnchorTypes: NOTEBOOK_GRAPH_FORBIDDEN_ANCHOR_TYPES,
    manager: createNotebookGraphMergeWriter(input.manager, input.notebookId),
    repo: createNotebookGraphMergeLookup(input.repo, input.notebookId)
  })
}

export async function mergeNotebookGraphNodeGroup(input: {
  vaultId: string
  vaultName: string
  notebookId: string
  survivorId: string
  loserIds: string[]
  reason?: string
  now?: number
  manager: NotebookGraphMergeRaw
  repo: NotebookGraphMergeRepo
}): Promise<{ survivorId: string; loserIds: string[] }> {
  return mergeDiaryGraphNodeGroup({
    vaultId: input.vaultId,
    vaultName: input.vaultName,
    survivorId: input.survivorId,
    loserIds: input.loserIds,
    reason: input.reason,
    now: input.now,
    forbiddenAnchorTypes: NOTEBOOK_GRAPH_FORBIDDEN_ANCHOR_TYPES,
    manager: createNotebookGraphMergeWriter(input.manager, input.notebookId),
    repo: createNotebookGraphMergeLookup(input.repo, input.notebookId)
  })
}
