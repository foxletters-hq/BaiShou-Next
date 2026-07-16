import { MEMORY_SOURCE_TYPE, type MemoryRawRecord } from '@baishou/shared'
import type { MemoryRawManager } from './managers/memory.raw-manager'

export interface LegacyEmbeddingChunk {
  sourceId: string
  chunkText: string
  groupId: string
  chunkIndex: number
  sourceCreatedAt: number | null
}

/**
 * Backfill Memory JSONL from existing embeddings (chat / mem_*).
 * Does NOT re-embed; keeps original sourceId as row id (or legacySourceId).
 */
export class MemoryJsonlBackfillService {
  constructor(private readonly memoryManager: MemoryRawManager) {}

  async backfillFromChunks(
    chunks: LegacyEmbeddingChunk[],
    vaultName: string
  ): Promise<{ written: number; skipped: number }> {
    // Group chunk_index 0 (or concatenate) per sourceId
    const bySource = new Map<string, LegacyEmbeddingChunk[]>()
    for (const chunk of chunks) {
      if (!chunk.sourceId) continue
      const list = bySource.get(chunk.sourceId) ?? []
      list.push(chunk)
      bySource.set(chunk.sourceId, list)
    }

    let written = 0
    let skipped = 0
    const existingShards = await this.memoryManager.listShards()
    const existingIds = new Set<string>()
    for (const shard of existingShards) {
      const rows = (await this.memoryManager.readShardRecords(
        shard.relativePath
      )) as MemoryRawRecord[]
      for (const row of rows) {
        if (row?.id) existingIds.add(row.id)
        if (row?.legacySourceId) existingIds.add(row.legacySourceId)
      }
    }

    for (const [sourceId, group] of bySource) {
      if (existingIds.has(sourceId)) {
        skipped += 1
        continue
      }
      group.sort((a, b) => a.chunkIndex - b.chunkIndex)
      const content = group
        .map((c) => c.chunkText)
        .filter(Boolean)
        .join('\n')
      if (!content.trim()) {
        skipped += 1
        continue
      }
      const createdAt = group[0]?.sourceCreatedAt ?? Date.now()
      const record: MemoryRawRecord = {
        id: sourceId,
        schemaVersion: 1,
        vaultName,
        content,
        tags: [],
        sourceSessionId: group[0]?.groupId?.startsWith('memory:')
          ? null
          : (group[0]?.groupId ?? null),
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
        legacySourceId: sourceId.startsWith('mem_') ? sourceId : undefined
      }
      const writtenShard = await this.memoryManager.writeRecord(record)
      // Vectors already exist — mark this shard indexed so sync won't re-embed.
      await this.memoryManager.commitIndexed(
        writtenShard.relativePath,
        writtenShard.contentHash
      )
      written += 1
      existingIds.add(sourceId)
    }

    void MEMORY_SOURCE_TYPE
    return { written, skipped }
  }
}
