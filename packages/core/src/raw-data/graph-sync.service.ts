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

  async syncPendingIndex(): Promise<{
    shards: number
    nodesUpserted: number
    edgesUpserted: number
    deleted: number
  }> {
    const pending = await this.graphManager.listPendingIndex()
    let nodesUpserted = 0
    let edgesUpserted = 0
    let deleted = 0

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
          updatedAt: number
        }>
      )

      if (collection === 'nodes') {
        for (const raw of rows as GraphNodeRawRecord[]) {
          if (!raw?.id) continue
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

    // After dirty shards: soft-delete graph rows whose ids no longer exist in any JSONL shard
    if (pending.length > 0) {
      const liveNodeIds = new Set<string>()
      const liveEdgeIds = new Set<string>()

      for (const shard of await this.graphManager.listShards()) {
        const [collection] = shard.relativePath.split(/[/\\]/)
        if (collection !== 'nodes' && collection !== 'edges') continue
        const rows = collapseJsonlById(
          (await this.graphManager.readShardRecords(shard.relativePath)) as Array<{
            id: string
            updatedAt: number
            deletedAt?: number | null
          }>
        )
        for (const row of rows) {
          if (!row?.id || row.deletedAt != null) continue
          if (collection === 'nodes') liveNodeIds.add(row.id)
          else liveEdgeIds.add(row.id)
        }
      }

      for (const id of await this.repo.listAllLiveNodeIds()) {
        if (!liveNodeIds.has(id)) {
          await this.repo.softDeleteNode(id)
          deleted += 1
        }
      }
      for (const id of await this.repo.listAllLiveEdgeIds()) {
        if (!liveEdgeIds.has(id)) {
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
