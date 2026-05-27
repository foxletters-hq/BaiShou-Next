export type MigrationBackupRow = {
  embeddingId: string
  sourceType: string
  sourceId: string
  groupId: string
  chunkIndex: number
  chunkText: string
  metadataJson: string
  sourceCreatedAt?: number
}

/** Normalized backup row with snake_case aliases for legacy migration callers. */
export type MigrationBackupRowCompat = MigrationBackupRow & {
  embedding_id: string
  source_type: string
  source_id: string
  group_id: string
  chunk_index: number
  chunk_text: string
  metadata_json: string
  source_created_at?: number
}

export function mapMigrationBackupRow(row: Record<string, unknown>): MigrationBackupRowCompat {
  const mapped: MigrationBackupRow = {
    embeddingId: String(row.embeddingId ?? row.embedding_id ?? ''),
    sourceType: String(row.sourceType ?? row.source_type ?? ''),
    sourceId: String(row.sourceId ?? row.source_id ?? ''),
    groupId: String(row.groupId ?? row.group_id ?? ''),
    chunkIndex: Number(row.chunkIndex ?? row.chunk_index ?? 0),
    chunkText: String(row.chunkText ?? row.chunk_text ?? ''),
    metadataJson: String(row.metadataJson ?? row.metadata_json ?? '{}'),
    sourceCreatedAt:
      row.sourceCreatedAt !== undefined
        ? Number(row.sourceCreatedAt)
        : row.source_created_at !== undefined
          ? Number(row.source_created_at)
          : undefined
  }

  return {
    ...mapped,
    embedding_id: mapped.embeddingId,
    source_type: mapped.sourceType,
    source_id: mapped.sourceId,
    group_id: mapped.groupId,
    chunk_index: mapped.chunkIndex,
    chunk_text: mapped.chunkText,
    metadata_json: mapped.metadataJson,
    source_created_at: mapped.sourceCreatedAt
  }
}

export function assertMigrationBackupRow(row: MigrationBackupRow): MigrationBackupRow {
  const chunkText = row.chunkText.trim()
  if (!row.embeddingId || !chunkText) {
    throw new Error(`Invalid backup chunk: missing id or text (id=${row.embeddingId || 'unknown'})`)
  }
  return { ...row, chunkText }
}
