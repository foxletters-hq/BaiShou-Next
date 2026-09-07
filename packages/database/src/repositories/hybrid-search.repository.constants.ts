export const HYBRID_SEARCH_TABLE = 'memory_embeddings'
export const HYBRID_SEARCH_BACKUP_TABLE = 'memory_embeddings_migration_backup'
export const HYBRID_SEARCH_ROLLBACK_TABLE = 'memory_embeddings_rollback'
export const HYBRID_SEARCH_INDEX_NAME = 'idx_memory_embeddings_vec'
export const EMBED_LEDGER_TABLE = 'embed_ledger'

export function buildEmbedLedgerScopeClause(params?: { vaultId?: string; sourceType?: string }): {
  clause: string
  args: string[]
} {
  const conditions: string[] = []
  const args: string[] = []
  const sourceType = params?.sourceType?.trim()
  if (sourceType === 'diary' || sourceType === 'memory') {
    conditions.push('source_type = ?')
    args.push(sourceType)
  } else {
    conditions.push(`source_type IN ('diary', 'memory')`)
  }
  const vaultId = params?.vaultId?.trim()
  if (vaultId) {
    conditions.push('vault_id = ?')
    args.push(vaultId)
  }
  return { clause: conditions.join(' AND '), args }
}

export interface HybridSearchRuntimeState {
  nativeVectorSupported: boolean | null
  vecDistanceCosineAvailable: boolean | null
  vectorTopKAvailable: boolean | null
}

export function createHybridSearchRuntimeState(): HybridSearchRuntimeState {
  return {
    nativeVectorSupported: null,
    vecDistanceCosineAvailable: null,
    vectorTopKAvailable: null
  }
}
