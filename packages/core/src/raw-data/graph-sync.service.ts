import type { GraphRepository } from '@baishou/database'
import type { GraphEdgeRawRecord, GraphNodeRawRecord } from './raw-data-source.types'
import type { GraphRawManager } from './managers/graph.raw-manager'
import { collapseJsonlById } from './stores/monthly-jsonl.store'

export interface GraphSyncEmbedder {
  embedQuery?(text: string): Promise<number[] | null>
  modelId?: string
}

/**
 * pending-index → GraphRepository (file first, then SQLite).
 */
export class GraphSyncService {
  constructor(
    private readonly graphManager: GraphRawManager,
    private readonly repo: GraphRepository,
    private readonly embedder?: GraphSyncEmbedder | null
  ) {}

  async syncPendingIndex(options?: { vaultName?: string }): Promise<{
    shards: number
    nodesUpserted: number
    edgesUpserted: number
    deleted: number
  }> {
    const pending = await this.graphManager.listPendingIndex()
    let nodesUpserted = 0
    let edgesUpserted = 0
    let deleted = 0
    let inferredVault = options?.vaultName

    for (const shard of pending) {
      const [collection] = shard.relativePath.split(/[/\\]/)
      if (collection === 'extract-state') {
        await this.graphManager.commitIndexed(
          collection,
          shard.relativePath,
          shard.contentHash
        )
        continue
      }

      const rows = collapseJsonlById(
        (await this.graphManager.readShardRecords(shard.relativePath)) as Array<{
          id: string
          vaultName?: string
          updatedAt: number
        }>
      )

      if (collection === 'nodes') {
        for (const raw of rows as GraphNodeRawRecord[]) {
          if (!raw?.id) continue
          if (!inferredVault && raw.vaultName) inferredVault = raw.vaultName
          if (raw.deletedAt != null) {
            await this.repo.softDeleteNode(raw.id)
            deleted += 1
            continue
          }
          let embedding: number[] | null = null
          if (this.embedder?.embedQuery) {
            try {
              embedding = await this.embedder.embedQuery(
                `${raw.name}\n${raw.summary || ''}`.trim()
              )
            } catch {
              embedding = null
            }
          }
          await this.repo.applyRawNode({
            ...raw,
            props: raw.props ?? {},
            shardMonth: shard.shardMonth,
            embedding,
            modelId: this.embedder?.modelId
          })
          nodesUpserted += 1
        }
      } else if (collection === 'edges') {
        for (const raw of rows as GraphEdgeRawRecord[]) {
          if (!raw?.id) continue
          if (!inferredVault && raw.vaultName) inferredVault = raw.vaultName
          if (raw.deletedAt != null) {
            await this.repo.softDeleteEdge(raw.id)
            deleted += 1
            continue
          }
          await this.repo.applyRawEdge({
            ...raw,
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

    // Orphan sweep scoped to vault(s) present in this manager's JSONL only.
    const liveNodeIdsByVault = new Map<string, Set<string>>()
    const liveEdgeIdsByVault = new Map<string, Set<string>>()

    for (const shard of await this.graphManager.listShards()) {
      const [collection] = shard.relativePath.split(/[/\\]/)
      if (collection !== 'nodes' && collection !== 'edges') continue
      const rows = collapseJsonlById(
        (await this.graphManager.readShardRecords(shard.relativePath)) as Array<{
          id: string
          vaultName?: string
          updatedAt: number
          deletedAt?: number | null
        }>
      )
      for (const row of rows) {
        if (!row?.id || row.deletedAt != null) continue
        const vault = row.vaultName || inferredVault
        if (!vault) continue
        if (!inferredVault) inferredVault = vault
        const bucket = collection === 'nodes' ? liveNodeIdsByVault : liveEdgeIdsByVault
        let set = bucket.get(vault)
        if (!set) {
          set = new Set()
          bucket.set(vault, set)
        }
        set.add(row.id)
      }
    }

    const vaults = new Set<string>([
      ...liveNodeIdsByVault.keys(),
      ...liveEdgeIdsByVault.keys(),
      ...(inferredVault ? [inferredVault] : [])
    ])

    for (const vault of vaults) {
      const liveNodes = liveNodeIdsByVault.get(vault) ?? new Set<string>()
      for (const id of await this.repo.listNodeIds(vault)) {
        if (!liveNodes.has(id)) {
          await this.repo.softDeleteNode(id)
          deleted += 1
        }
      }
      const liveEdges = liveEdgeIdsByVault.get(vault) ?? new Set<string>()
      for (const id of await this.repo.listEdgeIds(vault)) {
        if (!liveEdges.has(id)) {
          await this.repo.softDeleteEdge(id)
          deleted += 1
        }
      }
    }

    return {
      shards: pending.length,
      nodesUpserted,
      edgesUpserted,
      deleted
    }
  }
}
