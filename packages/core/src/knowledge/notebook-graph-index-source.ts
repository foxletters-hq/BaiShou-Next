import type { NotebookGraphCollection } from '@baishou/shared'

export interface NotebookGraphIndexShard {
  collection: NotebookGraphCollection
  shardMonth: string
  contentHash: string
}

/** JSONL pending-index surface used by NotebookGraphIndexService. */
export interface NotebookGraphIndexSource {
  listPendingIndex(notebookId: string): Promise<NotebookGraphIndexShard[]>
  invalidateIndexedHashes?(notebookId: string): Promise<void>
  commitIndexed(
    notebookId: string,
    collection: NotebookGraphCollection,
    shardMonth: string,
    contentHash: string
  ): Promise<void>
  readShardRecords(
    notebookId: string,
    collection: NotebookGraphCollection,
    shardMonth: string
  ): Promise<unknown[]>
  readCollapsed<T extends { id: string; updatedAt: number; deletedAt?: number | null }>(
    notebookId: string,
    collection: NotebookGraphCollection
  ): Promise<T[]>
  listShardMonths(notebookId: string, collection: NotebookGraphCollection): Promise<string[]>
  writeRecord?(
    notebookId: string,
    collection: NotebookGraphCollection,
    record: { id: string; shardMonth?: string; createdAt?: number; firstSeenAt?: number }
  ): Promise<void>
  tombstone?(
    notebookId: string,
    collection: NotebookGraphCollection,
    id: string,
    shardMonth?: string
  ): Promise<void>
}
