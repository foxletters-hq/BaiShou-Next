import { logger } from '@baishou/shared'
import type { NotebookGraphSyncApply } from '@baishou/database/shared'
import type {
  NotebookGraphEdgeRawRecord,
  NotebookGraphNodeRawRecord
} from '@baishou/shared'
import { collapseJsonlById } from '../raw-data/stores/monthly-jsonl.store'
import {
  collectAbsentDeleteIds,
  collectPresentMonths,
  type GraphAbsentSweepMode
} from '../raw-data/graph-orphan-sweep.util'
import type { NotebookGraphIndexSource } from './notebook-graph-index-source'

export class NotebookGraphIndexService {
  constructor(
    private readonly raw: NotebookGraphIndexSource,
    private readonly repo: NotebookGraphSyncApply
  ) {}

  async syncPendingIndex(opts: {
    vaultId: string
    notebookId: string
    absentSweep?: GraphAbsentSweepMode
    deletedShardPaths?: string[]
  }): Promise<{
    shards: number
    nodes: number
    edges: number
  }> {
    const notebookId = opts.notebookId.trim()
    const vaultId = opts.vaultId.trim()
    if (!notebookId || !vaultId) {
      throw new Error('NotebookGraphIndexService: vaultId and notebookId required')
    }

    if (opts.absentSweep !== 'off' && this.raw.invalidateIndexedHashes) {
      const live = await this.repo.listLiveIds({ vaultId, notebookId })
      if (live.nodes.length === 0 && live.edges.length === 0) {
        await this.raw.invalidateIndexedHashes(notebookId)
      }
    }

    const pending = await this.raw.listPendingIndex(notebookId)
    let nodes = 0
    let edges = 0

    for (const shard of pending) {
      if (shard.collection === 'extract-state') {
        await this.raw.commitIndexed(notebookId, shard.collection, shard.shardMonth, shard.contentHash)
        continue
      }
      const rawRows = (await this.raw.readShardRecords(
        notebookId,
        shard.collection,
        shard.shardMonth
      )) as Array<{ id: string; updatedAt: number; deletedAt?: number | null; vaultId?: string }>
      const rows = collapseJsonlById(rawRows)
      if (shard.collection === 'nodes') {
        for (const row of rows as NotebookGraphNodeRawRecord[]) {
          if (!row?.id || row.vaultId !== vaultId || row.notebookId !== notebookId) continue
          const applied = await this.repo.applyRawNode(row)
          if (applied && applied.remappedFrom) {
            await this.writeBackUniqueMerge(row, applied, vaultId, notebookId)
          }
          nodes += 1
        }
      } else if (shard.collection === 'edges') {
        for (const row of rows as NotebookGraphEdgeRawRecord[]) {
          if (!row?.id || row.vaultId !== vaultId || row.notebookId !== notebookId) continue
          await this.repo.applyRawEdge(row)
          edges += 1
        }
      }
      await this.raw.commitIndexed(notebookId, shard.collection, shard.shardMonth, shard.contentHash)
    }

    if (opts.absentSweep !== 'off') {
      await this.sweepOrphans(vaultId, notebookId, opts.deletedShardPaths)
    }
    logger.info('[NotebookGraphIndex] pending-index', { notebookId, shards: pending.length, nodes, edges })
    return { shards: pending.length, nodes, edges }
  }

  private async writeBackUniqueMerge(
    raw: NotebookGraphNodeRawRecord,
    applied: {
      id: string
      remappedFrom?: string
      remappedFromShardMonth?: string
      writeBackSurvivor?: boolean
    },
    vaultId: string,
    notebookId: string
  ): Promise<void> {
    if (!applied.writeBackSurvivor || !this.raw.writeRecord) return
    const live =
      typeof this.repo.getNodeById === 'function'
        ? await this.repo.getNodeById(applied.id, vaultId, notebookId)
        : null
    let aliases = raw.aliases ?? []
    if (typeof live?.aliases === 'string' && live.aliases.trim()) {
      try {
        const parsed = JSON.parse(live.aliases) as unknown
        if (Array.isArray(parsed)) {
          aliases = parsed.filter((x): x is string => typeof x === 'string')
        }
      } catch {
        aliases = raw.aliases ?? []
      }
    }
    const record: NotebookGraphNodeRawRecord = {
      ...raw,
      id: applied.id,
      vaultId,
      notebookId,
      aliases,
      name: live?.name ?? raw.name,
      summary: live?.summary ?? raw.summary ?? '',
      shardMonth: raw.shardMonth,
      deletedAt: null,
      updatedAt: Date.now()
    }
    if (!record.shardMonth) return
    try {
      await this.raw.writeRecord(notebookId, 'nodes', record)
    } catch {
      // File write-back is best-effort; SQLite already converged
    }
  }

  private async sweepOrphans(
    vaultId: string,
    notebookId: string,
    deletedShardPaths?: string[]
  ): Promise<void> {
    const diskNodes = await this.raw.readCollapsed<NotebookGraphNodeRawRecord>(notebookId, 'nodes')
    const diskEdges = await this.raw.readCollapsed<NotebookGraphEdgeRawRecord>(notebookId, 'edges')
    const liveNodeIds = new Set(diskNodes.map((n) => n.id))
    const liveEdgeIds = new Set(diskEdges.map((e) => e.id))
    const presentNodes = collectPresentMonths({
      shardMonths: await this.raw.listShardMonths(notebookId, 'nodes'),
      deletedPaths: deletedShardPaths,
      collection: 'nodes',
      notebookId
    })
    const presentEdges = collectPresentMonths({
      shardMonths: await this.raw.listShardMonths(notebookId, 'edges'),
      deletedPaths: deletedShardPaths,
      collection: 'edges',
      notebookId
    })
    const db = await this.repo.listLiveIds({ vaultId, notebookId })
    for (const id of collectAbsentDeleteIds(db.nodes, liveNodeIds, presentNodes)) {
      await this.repo.softDeleteNode(id, notebookId)
    }
    for (const id of collectAbsentDeleteIds(db.edges, liveEdgeIds, presentEdges)) {
      await this.repo.softDeleteEdge(id, notebookId)
    }
  }
}
