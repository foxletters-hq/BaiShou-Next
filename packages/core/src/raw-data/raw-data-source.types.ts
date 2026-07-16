/** Whitelisted raw data source kinds (syncable file layer). */
export type RawSourceKind = 'journal' | 'summary' | 'session' | 'memory' | 'graph' | 'notebook'

export type GraphCollection = 'nodes' | 'edges' | 'extract-state'

export type RawSourceShape = 'whole-file' | 'record-collection'

export interface WriteOpts {
  vaultName?: string
  /** Skip version snapshot for whole-file writes */
  skipVersion?: boolean
}

export interface ShardInfo {
  path: string
  /** Relative path under kind root (e.g. 2026-07.jsonl or nodes/2026-07.jsonl) */
  relativePath: string
  contentHash: string
  shardMonth: string
}

export interface ShardsManifest {
  schemaVersion: 1
  updatedAt: number
  shards: Record<
    string,
    {
      contentHash: string
      /** Last contentHash that was fully indexed into derived SQLite */
      indexedHash?: string
    }
  >
}

export type { MemoryRawRecord } from '@baishou/shared'

/** Appendix B.2 — Graph node JSONL row (subset used by P1) */
export interface GraphNodeRawRecord {
  id: string
  schemaVersion: 1
  vaultName: string
  nodeType: string
  name: string
  aliases: string[]
  summary: string
  props: Record<string, unknown>
  mentionCount: number
  firstSeenAt: number
  lastSeenAt: number
  origin: 'ai' | 'user'
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  reviewStatus?: 'approved' | 'pending' | 'rejected'
}

/** Appendix B.3 — Graph edge JSONL row */
export interface GraphEdgeRawRecord {
  id: string
  schemaVersion: 1
  vaultName: string
  fromId: string
  toId: string
  edgeType: string
  props: Record<string, unknown>
  validFrom: number | null
  validTo: number | null
  isCurrent: boolean
  sourceKind: 'diary' | 'session' | 'memory' | 'manual' | string
  sourceRef: string | null
  sourceExcerpt: string
  sourceContentHash: string | null
  confidence: number
  origin: 'ai' | 'user'
  reviewStatus: 'approved' | 'pending' | 'rejected'
  shardMonth: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

/** Appendix B.4 — extract-state cursor (P2 uses; P1 stores only) */
export interface GraphExtractStateRawRecord {
  id: string
  schemaVersion: 1
  vaultName: string
  filePath: string
  sourceContentHash: string
  extractedAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface RawSourceKindManager {
  readonly kind: RawSourceKind
  readonly shape: RawSourceShape
}

export interface RecordCollectionKindManager extends RawSourceKindManager {
  readonly shape: 'record-collection'
  writeRecord(
    record: unknown,
    opts?: { collection?: GraphCollection } & WriteOpts
  ): Promise<{ shardPath: string; relativePath: string; contentHash: string }>
  tombstone(
    id: string,
    opts: WriteOpts & { collection?: GraphCollection; shardMonth?: string }
  ): Promise<void>
  listShards(): Promise<ShardInfo[]>
  readShardRecords(relativePath: string): Promise<unknown[]>
}

export interface WholeFileKindManager extends RawSourceKindManager {
  readonly shape: 'whole-file'
  writeFile(
    relativePath: string,
    content: string | Uint8Array,
    opts?: WriteOpts
  ): Promise<{ contentHash: string }>
}
