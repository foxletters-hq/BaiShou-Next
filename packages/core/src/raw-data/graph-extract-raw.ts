import type { GraphCollection, WriteOpts } from './raw-data-source.types'

/** JSONL writes used by diary extract commit — not the full raw manager. */
export interface GraphExtractRawWriter {
  writeRecord(
    record: unknown,
    opts?: { collection?: GraphCollection } & WriteOpts
  ): Promise<unknown>
  writeRecords?(
    records: unknown[],
    opts?: { collection?: GraphCollection } & WriteOpts
  ): Promise<void>
  removeRecordsFromShard(
    collection: GraphCollection,
    shardMonth: string,
    ids: readonly string[]
  ): Promise<number>
  compactShard(collection: GraphCollection, shardMonth: string): Promise<unknown>
  commitIndexed?(collection: string, relativePath: string, contentHash: string): Promise<void>
  supersedeAiEdgesBySourceRef(
    sourceRef: string,
    opts?: { exceptIds?: ReadonlySet<string>; shardMonth?: string }
  ): Promise<number>
  supersedeAiEdgesBySourceRefsBatch?(
    items: ReadonlyArray<{
      sourceRef: string
      exceptIds?: ReadonlySet<string>
      shardMonth?: string
    }>,
    opts?: { skipCompact?: boolean }
  ): Promise<number>
}
