import type { EmbeddingMigrationRollbackConfig } from './rag.types'

export type EmbeddingMigrationStatus = 'idle' | 'in_progress' | 'interrupted' | 'completed'

export interface EmbeddingMigrationStateRecord {
  status: EmbeddingMigrationStatus
  startedAt?: number
  completedAt?: number
  rollbackConfig?: EmbeddingMigrationRollbackConfig
}

export interface EmbeddingMigrationStateView extends EmbeddingMigrationStateRecord {
  /** True when a pre-migration rollback snapshot exists and restore is available. */
  canRestore: boolean
  /** True when chunk-level migration backup remains and migration can be resumed. */
  canResume: boolean
}

export const EMBEDDING_MIGRATION_STATE_KEY = 'embedding_migration_state'
