import type { ShardInfo } from './raw-data-source.types'

/** JSONL pending-index surface used by GraphSyncService — not the full raw manager. */
export interface GraphIndexSource {
  listPendingIndex(): Promise<ShardInfo[]>
  readShardRecords(relativePath: string): Promise<unknown[]>
  commitIndexed(collection: string, relativePath: string, contentHash: string): Promise<void>
  listShards(): Promise<ShardInfo[]>
  invalidateIndexedHashes?(): Promise<void>
  writeRecord?(
    record: unknown,
    opts?: { collection?: 'nodes' | 'edges' }
  ): Promise<unknown>
  removeRecordsFromShard?(
    collection: 'nodes' | 'edges',
    shardMonth: string,
    ids: readonly string[]
  ): Promise<number>
}
