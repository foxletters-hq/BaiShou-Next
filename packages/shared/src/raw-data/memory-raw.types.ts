/** Memory JSONL row (appendix B.1) — shared so tools need not import @baishou/core */
export interface MemoryRawRecord {
  id: string
  schemaVersion: 1
  vaultName: string
  content: string
  tags: string[]
  sourceSessionId: string | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  legacySourceId?: string
}

export const MEMORY_SOURCE_TYPE = 'memory' as const

/** Minimal facade used by AI tools (implemented by core RawDataSourceManager). */
export interface ToolRawDataSourceManager {
  writeRecord(
    kind: 'memory' | 'graph',
    record: unknown,
    opts?: { collection?: string }
  ): Promise<{ shardPath: string; relativePath: string; contentHash: string }>
  tombstone(
    kind: 'memory' | 'graph',
    id: string,
    opts?: { collection?: string; shardMonth?: string }
  ): Promise<void>
  getMemoryManager?: () =>
    | {
        commitIndexed(relativePath: string, contentHash: string): Promise<void>
      }
    | undefined
  getGraphManager?: () =>
    | {
        commitIndexed(collection: string, relativePath: string, contentHash: string): Promise<void>
      }
    | undefined
}
