import i18n from 'i18next'
import { ipcMain } from 'electron'
import {
  mergeDiaryGraphNodeGroup,
  mergeDiaryGraphNodes,
  applyDiaryGraphSurgicalDelete,
  revertGraphNodeSplit,
  splitGraphNode,
  syncDiaryGraphMergeGroupIntoIndex,
  syncDiaryGraphMergeIntoIndex,
  type GraphSplitEdgeAssignment,
  type GraphEdgeRawRecord,
  type GraphNodeRawRecord
} from '@baishou/core-desktop'
import { GRAPH_EDGE_TYPES, GRAPH_NODE_TYPES } from '@baishou/database-desktop'
import {
  graphDiaryInstant,
  graphEdgeId,
  graphNodeIdForEntity,
  graphSameNameExistingFromRow,
  type GraphSetReviewsBatchInput
} from '@baishou/shared'
import { resolveVaultNameById } from './vault.ipc'
import { getGraphRawManager, syncGraphPendingIndex } from '../services/raw-data-source.runtime'
import {
  parseProps,
  requireGraphRepo,
  requireVaultId,
  requireVaultName,
  writeVaultId
} from './graph-ipc.context'
import {
  listNameCandidatesForNode,
  listSplitEdgesForNode,
  toNameCandidate
} from './graph-name-candidates'
import {
  applyGraphReviews,
  writeDismissSimilarPair,
  writeEdgeReview,
  writeNodeReview
} from './graph-review.write'

export function registerGraphMutateIpc(): void {
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
      const shardMonth = existing?.shardMonth || graphDiaryInstant(null, now).shardMonth
      if (nodeType === 'entry' && !existing?.id && !input.id) {
        throw new Error(
          i18n.t(
            'graph.entry_node_requires_diary_path',
            'entry 节点必须基于日记路径，不能手建随机 id'
          )
        )
      }
      const sameNameHits = await repo.findNodesByNameOrAlias(
        vaultId,
        name,
        existing?.nodeType || nodeType
      )
      const currentId = existing?.id || input.id
      // 唯一索引已含区分信息；只比 id 会把裸名行当成冲突，拆出的节点就再也存不进去。
      const currentDiscriminator = existing?.discriminator ?? ''
      const sameName = graphSameNameExistingFromRow(
        sameNameHits.find(
          (row) => row.id !== currentId && (row.discriminator ?? '') === currentDiscriminator
        ) ?? null,
        currentId
      )
      if (sameName) {
        const candidates = sameNameHits.map((row) => toNameCandidate(row))
        return {
          conflict: 'same-name' as const,
          existing: sameName,
          candidates,
          canRegisterAnother: (existing?.nodeType || nodeType) !== 'entry'
        }
      }
      const record: GraphNodeRawRecord = {
        id: existing?.id || input.id || graphNodeIdForEntity(vaultId, nodeType, name),
        schemaVersion: 1,
        vaultId,
        vaultName: resolveVaultNameById(vaultId) || vaultName,
        nodeType: existing?.nodeType || nodeType,
        name,
        // 手工建点永远是裸名；编辑已有节点必须带回原区分信息，否则 JSONL 缺字段会被归一成空串。
        discriminator: existing?.discriminator ?? '',
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
        id: input.id || graphEdgeId(vaultId, input.fromId, input.toId, edgeType, sourceRef),
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

  ipcMain.handle(
    'graph:split-node',
    async (
      _e,
      opts: {
        bareNodeId: string
        discriminator: string
        label: string
        summary?: string
        edgeAssignments?: GraphSplitEdgeAssignment[]
        reason?: string
      }
    ) => {
      const manager = getGraphRawManager()
      const repo = requireGraphRepo()
      const result = await splitGraphNode({
        vaultId: requireVaultId(),
        vaultName: requireVaultName(),
        bareNodeId: opts.bareNodeId,
        discriminator: opts.discriminator,
        label: opts.label,
        summary: opts.summary,
        edgeAssignments: opts.edgeAssignments ?? [],
        reason: opts.reason,
        manager,
        repo
      })
      await syncGraphPendingIndex()
      return { ok: true, ...result }
    }
  )

  ipcMain.handle(
    'graph:revert-node-split',
    async (_e, opts: { bareNodeId: string; discriminator: string; reason?: string }) => {
      const manager = getGraphRawManager()
      const repo = requireGraphRepo()
      const result = await revertGraphNodeSplit({
        vaultId: requireVaultId(),
        vaultName: requireVaultName(),
        bareNodeId: opts.bareNodeId,
        discriminator: opts.discriminator,
        reason: opts.reason,
        manager,
        repo
      })
      if (result.removedNodeId) {
        await syncDiaryGraphMergeIntoIndex({
          loserId: result.removedNodeId,
          syncPendingIndex: syncGraphPendingIndex,
          softDeleteNode: (id) => repo.softDeleteNode(id)
        })
      } else {
        await syncGraphPendingIndex()
      }
      return { ok: true, ...result }
    }
  )

  ipcMain.handle(
    'graph:dismiss-similar-pair',
    async (_e, opts: { nodeId: string; peerId: string }) => {
      await writeDismissSimilarPair(opts.nodeId, opts.peerId)
      return { ok: true }
    }
  )

  ipcMain.handle('graph:list-name-candidates', async (_e, opts: { nodeId: string }) => {
    return listNameCandidatesForNode(opts.nodeId)
  })

  ipcMain.handle('graph:list-split-edges', async (_e, opts: { nodeId: string }) => {
    return listSplitEdgesForNode(opts.nodeId)
  })
}
