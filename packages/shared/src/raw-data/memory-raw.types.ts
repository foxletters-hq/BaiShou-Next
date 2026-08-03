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

/** Redundant fields stored in memory_embeddings.metadata_json for management-page display. */
export interface MemoryEmbeddingMeta {
  tags: string[]
  sourceSessionId: string | null
  createdAt: number
  updatedAt: number
}

export function buildMemoryMetadataJson(
  record: Pick<MemoryRawRecord, 'tags' | 'sourceSessionId' | 'createdAt' | 'updatedAt'>
): string {
  const meta: MemoryEmbeddingMeta = {
    tags: Array.isArray(record.tags) ? record.tags : [],
    sourceSessionId: record.sourceSessionId ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }
  return JSON.stringify(meta)
}

export function parseMemoryMetadataJson(
  raw: string | null | undefined
): Partial<MemoryEmbeddingMeta> {
  if (!raw || raw === '{}') return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t): t is string => typeof t === 'string')
      : undefined
    return {
      ...(tags ? { tags } : {}),
      ...(parsed.sourceSessionId === null || typeof parsed.sourceSessionId === 'string'
        ? { sourceSessionId: parsed.sourceSessionId as string | null }
        : {}),
      ...(typeof parsed.createdAt === 'number' ? { createdAt: parsed.createdAt } : {}),
      ...(typeof parsed.updatedAt === 'number' ? { updatedAt: parsed.updatedAt } : {})
    }
  } catch {
    return {}
  }
}

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
