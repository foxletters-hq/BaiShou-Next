import {
  collectSimilarPendingPairs,
  parseGraphNodePropsRecord,
  removeSimilarPendingPeerFromProps,
  type GraphSimilarPendingPair,
  type NotebookGraphNodeRawRecord
} from '@baishou/shared'
import {
  mergeNotebookGraphNodeGroup,
  mergeNotebookGraphNodes,
  NotebookGraphRawManager,
  syncDiaryGraphMergeGroupIntoIndex,
  syncDiaryGraphMergeIntoIndex
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
  const { NotebookGraphIndexService } = await import('@baishou/core-desktop')
  const { getEmbeddingService, getEmbeddingConfig } = await import('../ipc/rag.ipc')
  const embeddingService = getEmbeddingService()
  const modelId = getEmbeddingConfig().getGlobalEmbeddingModelId().trim()
  const index = new NotebookGraphIndexService(
    raw,
    repo,
    embeddingService.isConfigured && modelId
      ? {
          embedQuery: (text) => embeddingService.embedQuery(text),
          modelId
        }
      : null
  )
  await index.syncPendingIndex({ vaultId, notebookId, absentSweep: 'off' })
}

export async function mergeDesktopNotebookGraphNodes(input: {
  notebookId: string
  survivorId: string
  loserId: string
  reason?: string
}): Promise<{ ok: true; survivorId: string; loserId: string }> {
  const notebookId = requireNotebookId(input.notebookId)
  const vaultId = requireVaultId()
  const repo = requireRepo()
  const result = await mergeNotebookGraphNodes({
    vaultId,
    vaultName: resolveVaultNameById(vaultId),
    notebookId,
    survivorId: input.survivorId,
    loserId: input.loserId,
    reason: input.reason,
    manager: createRaw(),
    repo
  })
  await syncDiaryGraphMergeIntoIndex({
    loserId: result.loserId,
    syncPendingIndex: () => syncNotebookGraphIndex(notebookId),
    softDeleteNode: (id) => repo.softDeleteNode(id, notebookId)
  })
  return { ok: true, ...result }
}

export async function mergeDesktopNotebookGraphNodeGroup(input: {
  notebookId: string
  survivorId: string
  loserIds: string[]
  reason?: string
}): Promise<{ ok: true; survivorId: string; loserIds: string[] }> {
  const notebookId = requireNotebookId(input.notebookId)
  const vaultId = requireVaultId()
  const repo = requireRepo()
  const result = await mergeNotebookGraphNodeGroup({
    vaultId,
    vaultName: resolveVaultNameById(vaultId),
    notebookId,
    survivorId: input.survivorId,
    loserIds: input.loserIds,
    reason: input.reason,
    manager: createRaw(),
    repo
  })
  await syncDiaryGraphMergeGroupIntoIndex({
    loserIds: result.loserIds,
    syncPendingIndex: () => syncNotebookGraphIndex(notebookId),
    softDeleteNode: (id) => repo.softDeleteNode(id, notebookId)
  })
  return { ok: true, ...result }
}

export async function listDesktopNotebookSimilarPairs(
  notebookId: string
): Promise<GraphSimilarPendingPair[]> {
  const id = requireNotebookId(notebookId)
  const vaultId = requireVaultId()
  const view = await requireRepo().getView({ vaultId, notebookId: id, maxNodes: 400 })
  const peerNameById = new Map(view.nodes.map((node) => [node.id, node.name]))
  return collectSimilarPendingPairs(view.nodes, peerNameById)
}

export async function dismissDesktopNotebookSimilarPair(input: {
  notebookId: string
  nodeId: string
  peerId: string
}): Promise<{ ok: true }> {
  const notebookId = requireNotebookId(input.notebookId)
  const vaultId = requireVaultId()
  const peerId = input.peerId.trim()
  if (!peerId) return { ok: true }
  const repo = requireRepo()
  const node = await repo.getNodeById(input.nodeId, vaultId, notebookId)
  if (!node) throw new Error(`Node not found: ${input.nodeId}`)
  const now = Date.now()
  const record: NotebookGraphNodeRawRecord = {
    id: node.id,
    schemaVersion: 1,
    vaultId,
    vaultName: resolveVaultNameById(vaultId),
    notebookId,
    nodeType: node.nodeType,
    name: node.name,
    discriminator: node.discriminator ?? '',
    aliases: parseAliases(node.aliases),
    summary: node.summary || '',
    props: removeSimilarPendingPeerFromProps(parseGraphNodePropsRecord(node.propsJson), peerId),
    mentionCount: node.mentionCount,
    firstSeenAt: node.firstSeenAt ?? now,
    lastSeenAt: node.lastSeenAt ?? now,
    origin: node.origin === 'user' ? 'user' : 'ai',
    shardMonth: node.shardMonth,
    createdAt: node.createdAt,
    updatedAt: now,
    deletedAt: null,
    reviewStatus:
      node.reviewStatus === 'pending' || node.reviewStatus === 'rejected'
        ? node.reviewStatus
        : 'approved'
  }
  if (!record.shardMonth) throw new Error(`Node shard missing: ${node.id}`)
  await createRaw().writeNode(record)
  await syncNotebookGraphIndex(notebookId)
  return { ok: true }
}
