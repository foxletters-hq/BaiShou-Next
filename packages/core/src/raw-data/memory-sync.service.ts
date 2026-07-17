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
  listSourceIdsByType?(sourceType: string, groupId?: string): Promise<string[]>
}

/**
 * pending-index → differential embed into memory_embeddings.
 */
export class MemorySyncService {
  constructor(
    private readonly memoryManager: MemoryRawManager,
    private readonly sink: MemoryEmbedSink
  ) {}

  async syncPendingIndex(options?: {
    vaultName?: string
  }): Promise<{ shards: number; upserted: number; deleted: number }> {
    const pending = await this.memoryManager.listPendingIndex()
    let upserted = 0
    let deleted = 0
    let inferredVault = options?.vaultName

    for (const shard of pending) {
      const rows = collapseJsonlById(
        (await this.memoryManager.readShardRecords(shard.relativePath)) as MemoryRawRecord[]
      )

      for (const row of rows) {
        if (!row?.id) continue
        if (!inferredVault && row.vaultName) inferredVault = row.vaultName
        if (row.deletedAt != null) {
          await this.sink.deleteBySource?.(MEMORY_SOURCE_TYPE, row.id)
          deleted += 1
          continue
        }
        await this.sink.embedText({
          text: row.content,
          sourceType: MEMORY_SOURCE_TYPE,
          sourceId: row.id,
          groupId: `memory:${row.vaultName}`
        })
        upserted += 1
      }

      await this.memoryManager.commitIndexed(shard.relativePath, shard.contentHash)
    }

    // Orphan sweep scoped to vault(s) present in this manager's JSONL only.
    if (this.sink.listSourceIdsByType && this.sink.deleteBySource) {
      const liveIdsByVault = new Map<string, Set<string>>()
      for (const shard of await this.memoryManager.listShards()) {
        const rows = collapseJsonlById(
          (await this.memoryManager.readShardRecords(shard.relativePath)) as MemoryRawRecord[]
        )
        for (const row of rows) {
          if (row?.id && row.deletedAt == null && row.vaultName) {
            if (!inferredVault) inferredVault = row.vaultName
            let set = liveIdsByVault.get(row.vaultName)
            if (!set) {
              set = new Set()
              liveIdsByVault.set(row.vaultName, set)
            }
            set.add(row.id)
          }
        }
      }

      const vaults = new Set<string>([
        ...liveIdsByVault.keys(),
        ...(inferredVault ? [inferredVault] : [])
      ])

      for (const vault of vaults) {
        const liveIds = liveIdsByVault.get(vault) ?? new Set<string>()
        const groupId = `memory:${vault}`
        const dbIds = await this.sink.listSourceIdsByType(MEMORY_SOURCE_TYPE, groupId)
        for (const id of dbIds) {
          if (!liveIds.has(id)) {
            await this.sink.deleteBySource(MEMORY_SOURCE_TYPE, id)
            deleted += 1
          }
        }
      }
    }

    return { shards: pending.length, upserted, deleted }
  }
}
