export const HYBRID_SEARCH_TABLE = 'memory_embeddings'
export const HYBRID_SEARCH_BACKUP_TABLE = 'memory_embeddings_migration_backup'
export const HYBRID_SEARCH_INDEX_NAME = 'idx_memory_embeddings_vec'

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
