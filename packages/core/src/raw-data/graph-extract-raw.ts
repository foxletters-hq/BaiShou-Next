import type { GraphCollection, WriteOpts } from './raw-data-source.types'

/** JSONL writes used by diary extract commit — not the full raw manager. */
export interface GraphExtractRawWriter {
  writeRecord(
    record: unknown,
    opts?: { collection?: GraphCollection } & WriteOpts
  ): Promise<unknown>
  removeRecordsFromShard(
    collection: GraphCollection,
    shardMonth: string,
    ids: readonly string[]
  ): Promise<number>
  compactShard(collection: GraphCollection, shardMonth: string): Promise<unknown>
  supersedeAiEdgesBySourceRef(
    sourceRef: string,
    opts?: { exceptIds?: ReadonlySet<string>; shardMonth?: string }
  ): Promise<number>
}
