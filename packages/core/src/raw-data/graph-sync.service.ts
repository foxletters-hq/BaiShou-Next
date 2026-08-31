import type { GraphSyncApply } from '@baishou/database/shared'
import { isVaultId } from '@baishou/shared'
import type { GraphEdgeRawRecord, GraphNodeRawRecord } from './raw-data-source.types'
import { collapseJsonlById } from './stores/monthly-jsonl.store'
import type { GraphIndexSource } from './graph-index-source'
import {
  collectAbsentDeleteIds,
  collectPresentMonths,
  type GraphAbsentSweepMode
} from './graph-orphan-sweep.util'

export interface GraphSyncEmbedder {
  embedQuery?(text: string): Promise<number[] | null>
  modelId?: string
}

export interface GraphPendingIndexSyncOpts {
  absentSweep?: GraphAbsentSweepMode
  deletedShardPaths?: string[]
  vaultId?: string
}

export interface GraphPendingIndexSync {
  syncPendingIndex(opts?: GraphPendingIndexSyncOpts): Promise<{
    shards: number
    nodesUpserted: number
    edgesUpserted: number
    deleted: number
    skippedNoVaultId: number
  }>
}

/**
 * pending-index → GraphRepository (file first, then SQLite).
 * Rows without vaultId are skipped and never participate in orphan sweeps.
 * Absence deletes only rows whose shardMonth file is present locally (or deleted by sync).
 */
export class GraphSyncService implements GraphPendingIndexSync {
  constructor(
    private readonly graphManager: GraphIndexSource,
    private readonly repo: GraphSyncApply,
    private readonly embedder?: GraphSyncEmbedder | null
  ) {}

  async syncPendingIndex(opts?: GraphPendingIndexSyncOpts): Promise<{
    shards: number
    nodesUpserted: number
    edgesUpserted: number
    deleted: number
    skippedNoVaultId: number
  }> {
    if (opts?.absentSweep !== 'off' && opts?.vaultId && this.graphManager.invalidateIndexedHashes) {
      const liveNodes =
        typeof this.repo.listLiveNodeRefs === 'function'
          ? await this.repo.listLiveNodeRefs(opts.vaultId)
          : []
      const liveEdges =
        typeof this.repo.listLiveEdgeRefs === 'function'
          ? await this.repo.listLiveEdgeRefs(opts.vaultId)
          : []
      if (liveNodes.length === 0 && liveEdges.length === 0) {
        await this.graphManager.invalidateIndexedHashes()
      }
    }

    const pending = await this.graphManager.listPendingIndex()
    let nodesUpserted = 0
    let edgesUpserted = 0
    let deleted = 0
    let skippedNoVaultId = 0

    for (const shard of pending) {
      const [collection] = shard.relativePath.split(/[/\\]/)
      if (collection === 'extract-state') {
        await this.graphManager.commitIndexed(collection, shard.relativePath, shard.contentHash)
        continue
      }

      const rows = collapseJsonlById(
        (await this.graphManager.readShardRecords(shard.relativePath)) as Array<{
          id: string
          vaultId?: string
          vaultName?: string
          updatedAt: number
        }>
      )

      if (collection === 'nodes') {
        for (const raw of rows as GraphNodeRawRecord[]) {
          if (!raw?.id) continue
          const vaultId = raw.vaultId?.trim()
          if (!vaultId || !isVaultId(vaultId)) {
            skippedNoVaultId += 1
            continue
          }
          if (raw.deletedAt != null) {
            await this.repo.softDeleteNode(raw.id)
            deleted += 1
            continue
          }
          let embedding: number[] | null | undefined
          const existing =
            typeof this.repo.getNodeById === 'function'
              ? await this.repo.getNodeById(raw.id, vaultId)
              : null
          const reuseEmbed =
            !!existing &&
            !!this.embedder?.modelId &&
            existing.modelId === this.embedder.modelId &&
            (existing.dimension ?? 0) > 0
          if (this.embedder?.embedQuery && !reuseEmbed) {
            try {
              embedding = await this.embedder.embedQuery(`${raw.name}\n${raw.summary || ''}`.trim())
            } catch {
              embedding = null
            }
          }
          const applied = await this.repo.applyRawNode({
            ...raw,
            vaultId,
            props: raw.props ?? {},
            shardMonth: raw.shardMonth || shard.shardMonth,
            embedding,
            modelId: this.embedder?.modelId
          })
          if (applied && applied.remappedFrom) {
            await this.writeBackUniqueMerge(raw, applied, vaultId)
          }
          nodesUpserted += 1
        }
      } else if (collection === 'edges') {
        for (const raw of rows as GraphEdgeRawRecord[]) {
          if (!raw?.id) continue
          const vaultId = raw.vaultId?.trim()
          if (!vaultId || !isVaultId(vaultId)) {
            skippedNoVaultId += 1
            continue
          }
          if (raw.deletedAt != null) {
            await this.repo.softDeleteEdge(raw.id)
            deleted += 1
            continue
          }
          await this.repo.applyRawEdge({
            ...raw,
            vaultId,
            props: raw.props ?? {},
            isCurrent: raw.isCurrent ?? true,
            sourceExcerpt: raw.sourceExcerpt ?? '',
            confidence: raw.confidence ?? 100,
            validFrom: raw.validFrom ?? null,
            validTo: raw.validTo ?? null
          })
          edgesUpserted += 1
        }
      }

      await this.graphManager.commitIndexed(collection!, shard.relativePath, shard.contentHash)
    }

    if (opts?.absentSweep === 'off') {
      return {
        shards: pending.length,
        nodesUpserted,
        edgesUpserted,
        deleted,
        skippedNoVaultId
      }
    }

    const liveNodeIdsByVault = new Map<string, Set<string>>()
    const liveEdgeIdsByVault = new Map<string, Set<string>>()
    const nodeShardMonths: string[] = []
    const edgeShardMonths: string[] = []

    for (const shard of await this.graphManager.listShards()) {
      const [collection] = shard.relativePath.split(/[/\\]/)
      if (collection !== 'nodes' && collection !== 'edges') continue
      if (collection === 'nodes') nodeShardMonths.push(shard.shardMonth)
      else edgeShardMonths.push(shard.shardMonth)
      const rows = collapseJsonlById(
        (await this.graphManager.readShardRecords(shard.relativePath)) as Array<{
          id: string
          vaultId?: string
          updatedAt: number
          deletedAt?: number | null
        }>
      )
      for (const row of rows) {
        if (!row?.id || row.deletedAt != null) continue
        const vaultId = row.vaultId?.trim()
        if (!vaultId || !isVaultId(vaultId)) continue
        const bucket = collection === 'nodes' ? liveNodeIdsByVault : liveEdgeIdsByVault
        let set = bucket.get(vaultId)
        if (!set) {
          set = new Set()
          bucket.set(vaultId, set)
        }
        set.add(row.id)
      }
    }

    const presentNodes = collectPresentMonths({
      shardMonths: nodeShardMonths,
      deletedPaths: opts?.deletedShardPaths,
      collection: 'nodes'
    })
    const presentEdges = collectPresentMonths({
      shardMonths: edgeShardMonths,
      deletedPaths: opts?.deletedShardPaths,
      collection: 'edges'
    })

    const vaults = new Set<string>([...liveNodeIdsByVault.keys(), ...liveEdgeIdsByVault.keys()])
    const scopedVault = opts?.vaultId?.trim()
    if (scopedVault && isVaultId(scopedVault)) vaults.add(scopedVault)

    for (const vault of vaults) {
      const liveNodes = liveNodeIdsByVault.get(vault) ?? new Set<string>()
      const nodeRefs = await this.repo.listLiveNodeRefs(vault)
      for (const id of collectAbsentDeleteIds(nodeRefs, liveNodes, presentNodes)) {
        await this.repo.softDeleteNode(id)
        deleted += 1
      }
      const liveEdges = liveEdgeIdsByVault.get(vault) ?? new Set<string>()
      const edgeRefs = await this.repo.listLiveEdgeRefs(vault)
      for (const id of collectAbsentDeleteIds(edgeRefs, liveEdges, presentEdges)) {
        await this.repo.softDeleteEdge(id)
        deleted += 1
      }
    }

    return {
      shards: pending.length,
      nodesUpserted,
      edgesUpserted,
      deleted,
      skippedNoVaultId
    }
  }

  private async writeBackUniqueMerge(
    raw: GraphNodeRawRecord,
    applied: {
      id: string
      remappedFrom?: string
      remappedFromShardMonth?: string
      writeBackSurvivor?: boolean
    },
    vaultId: string
  ): Promise<void> {
    const loserId = applied.remappedFrom
    const loserMonth = applied.remappedFromShardMonth || raw.shardMonth
    if (loserId && loserMonth && this.graphManager.removeRecordsFromShard) {
      try {
        await this.graphManager.removeRecordsFromShard('nodes', loserMonth, [loserId])
      } catch {
        // Loser may only exist in SQLite
      }
    }
    if (!applied.writeBackSurvivor || !this.graphManager.writeRecord) return
    const live =
      typeof this.repo.getNodeById === 'function'
        ? await this.repo.getNodeById(applied.id, vaultId)
        : null
    const record: GraphNodeRawRecord = {
      ...raw,
      id: applied.id,
      vaultId,
      aliases: live?.aliases ?? raw.aliases ?? [],
      name: live?.name ?? raw.name,
      summary: live?.summary ?? raw.summary ?? '',
      shardMonth: live?.shardMonth || raw.shardMonth,
      deletedAt: null,
      updatedAt: Date.now()
    }
    if (!record.shardMonth) return
    try {
      await this.graphManager.writeRecord(record, { collection: 'nodes' })
    } catch {
      // File write-back is best-effort; SQLite already converged
    }
  }
}
