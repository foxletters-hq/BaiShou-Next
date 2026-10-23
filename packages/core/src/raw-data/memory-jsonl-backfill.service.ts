import { MEMORY_SOURCE_TYPE, buildMemoryMetadataJson, type MemoryRawRecord } from '@baishou/shared'
import type { MemoryRawManager } from './managers/memory.raw-manager'

export interface LegacyEmbeddingChunk {
  sourceId: string
  chunkText: string
  groupId: string
  chunkIndex: number
  sourceCreatedAt: number | null
}

export type MemoryBackfillMode = 'legacy' | 'manual'

export interface MemoryBackfillNormalizeSink {
  /** UPDATE source_type / group_id without touching embeddings. Returns affected source ids. */
  normalizeManualToMemory(params: { vaultName: string; sourceIds: string[] }): Promise<number>
  /** Patch metadata_json for an existing source without re-embedding. */
  updateMetadataBySource?(sourceType: string, sourceId: string, metadataJson: string): Promise<void>
}

/**
 * Backfill Memory JSONL from existing embeddings (chat / mem_* / manual).
 * Does NOT re-embed; keeps original sourceId as row id (or legacySourceId).
 */
export class MemoryJsonlBackfillService {
  constructor(private readonly memoryManager: MemoryRawManager) {}

  async backfillFromChunks(
    chunks: LegacyEmbeddingChunk[],
    vaultName: string,
    options?: { mode?: MemoryBackfillMode }
  ): Promise<{ written: number; skipped: number }> {
    const mode = options?.mode ?? 'legacy'
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
    const existingIds = await this.collectExistingIds()

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
      const sourceSessionId =
        mode === 'manual'
          ? null
          : group[0]?.groupId?.startsWith('memory:')
            ? null
            : (group[0]?.groupId ?? null)
      const record: MemoryRawRecord = {
        id: sourceId,
        schemaVersion: 1,
        vaultName,
        content,
        tags: [],
        sourceSessionId,
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
        legacySourceId: sourceId.startsWith('mem_') || mode === 'manual' ? sourceId : undefined
      }
      const writtenShard = await this.memoryManager.writeRecord(record)
      // Vectors already exist — mark this shard indexed so sync won't re-embed.
      await this.memoryManager.commitIndexed(writtenShard.relativePath, writtenShard.contentHash)
      written += 1
      existingIds.add(sourceId)
    }

    void MEMORY_SOURCE_TYPE
    return { written, skipped }
  }

  /**
   * Backfill manual embeddings into JSONL, then normalize source_type → memory
   * without re-embedding. Also patches metadata_json for live JSONL rows when sink supports it.
   */
  async migrateManualAndPatchMetadata(
    chunks: LegacyEmbeddingChunk[],
    vaultName: string,
    sink: MemoryBackfillNormalizeSink
  ): Promise<{ written: number; skipped: number; normalized: number; metadataPatched: number }> {
    const backfill = await this.backfillFromChunks(chunks, vaultName, { mode: 'manual' })
    const sourceIds = [
      ...new Set(chunks.map((c) => c.sourceId).filter((id): id is string => Boolean(id)))
    ]
    const normalized =
      sourceIds.length > 0 ? await sink.normalizeManualToMemory({ vaultName, sourceIds }) : 0

    let metadataPatched = 0
    if (sink.updateMetadataBySource) {
      metadataPatched = await this.patchMetadataFromJsonl(sink.updateMetadataBySource)
    }

    return {
      written: backfill.written,
      skipped: backfill.skipped,
      normalized,
      metadataPatched
    }
  }

  /** Write MemoryRawRecord display fields into existing vector rows' metadata_json. */
  async patchMetadataFromJsonl(
    updateMetadataBySource: (
      sourceType: string,
      sourceId: string,
      metadataJson: string
    ) => Promise<void>
  ): Promise<number> {
    let patched = 0
    for (const shard of await this.memoryManager.listShards()) {
      const rows = (await this.memoryManager.readCollapsedShard(
        shard.shardMonth
      )) as MemoryRawRecord[]
      for (const row of rows) {
        if (!row?.id || row.deletedAt != null) continue
        await updateMetadataBySource(MEMORY_SOURCE_TYPE, row.id, buildMemoryMetadataJson(row))
        patched += 1
      }
    }
    return patched
  }

  private async collectExistingIds(): Promise<Set<string>> {
    const existingIds = new Set<string>()
    for (const shard of await this.memoryManager.listShards()) {
      const rows = (await this.memoryManager.readShardRecords(
        shard.relativePath
      )) as MemoryRawRecord[]
      for (const row of rows) {
        if (row?.id) existingIds.add(row.id)
        if (row?.legacySourceId) existingIds.add(row.legacySourceId)
      }
    }
    return existingIds
  }
}
