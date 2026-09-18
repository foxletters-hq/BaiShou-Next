import type { EmbeddingMigrationRollbackConfig } from '@baishou/shared'
import type { IEmbeddingConfig, IEmbeddingStorage } from './embedding.types'

export type EmbeddingMigrationDeps = {
  config: IEmbeddingConfig
  db: IEmbeddingStorage
  isConfigured: boolean
  retryEmbed: (action: () => Promise<void>, label?: string) => Promise<void>
  rollbackConfig?: EmbeddingMigrationRollbackConfig
  lifecycle?: MigrationLifecycle
}

export type MigrationLifecycle = {
  markInProgress: (rollbackConfig?: EmbeddingMigrationRollbackConfig) => Promise<void>
  markCompleted: () => Promise<void>
  markInterrupted: () => Promise<void>
  markIdle: () => Promise<void>
  invalidateIndexedHashes?: () => Promise<void>
}
