import { MEMORY_SOURCE_TYPE, type MemoryRawRecord } from '@baishou/shared'
import type { MemoryRawManager } from './managers/memory.raw-manager'
import { collapseJsonlById } from './stores/monthly-jsonl.store'

export { MEMORY_SOURCE_TYPE }

export interface MemoryEmbedSink {
  embedText(options: {
    text: string
    sourceType: string
    sourceId: string
    groupId: string
  }): Promise<void>
  deleteBySource?(sourceType: string, sourceId: string): Promise<void>
  listSourceIdsByType?(sourceType: string): Promise<string[]>
}

/**
 * pending-index → differential embed into memory_embeddings.
 */
export class MemorySyncService {
  constructor(
    private readonly memoryManager: MemoryRawManager,
    private readonly sink: MemoryEmbedSink
  ) {}

  async syncPendingIndex(): Promise<{ shards: number; upserted: number; deleted: number }> {
    const pending = await this.memoryManager.listPendingIndex()
    let upserted = 0
    let deleted = 0

    for (const shard of pending) {
      const rows = collapseJsonlById(
        (await this.memoryManager.readShardRecords(shard.relativePath)) as MemoryRawRecord[]
      )
      const liveIds = new Set<string>()

      for (const row of rows) {
        if (!row?.id) continue
        if (row.deletedAt != null) {
          await this.sink.deleteBySource?.(MEMORY_SOURCE_TYPE, row.id)
          deleted += 1
          continue
        }
        liveIds.add(row.id)
        await this.sink.embedText({
          text: row.content,
          sourceType: MEMORY_SOURCE_TYPE,
          sourceId: row.id,
          groupId: `memory:${row.vaultName}`
        })
        upserted += 1
      }

      // Optional: remove embeddings for ids that disappeared from this shard's collapsed set
      // (only when sink can list — avoid wiping other shards' ids)
      void liveIds

      await this.memoryManager.commitIndexed(shard.relativePath, shard.contentHash)
    }

    return { shards: pending.length, upserted, deleted }
  }
}
