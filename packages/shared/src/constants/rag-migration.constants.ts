export const RAG_MIGRATION_STATUS = {
  alreadyRunning: 'settings.rag_migration_already_running',
  modelNotConfigured: 'settings.rag_migration_model_not_configured',
  providerNotFound: 'settings.rag_migration_provider_not_found',
  backingUp: 'settings.rag_migration_backing_up',
  noData: 'settings.rag_migration_no_data',
  detectingDimension: 'settings.rag_migration_detecting_dimension',
  dimensionCheckFailed: 'settings.rag_migration_dimension_failed',
  reembedding: 'settings.rag_migration_reembedding',
  inProgress: 'settings.rag_migration_in_progress',
  inProgressWithFailures: 'settings.rag_migration_in_progress_with_failures',
  complete: 'settings.rag_migration_complete_status',
  verifyPartial: 'settings.rag_migration_verify_partial',
  verifyStale: 'settings.rag_migration_verify_stale',
  verifyBoth: 'settings.rag_migration_verify_both',
  finished: 'settings.rag_migration_finished',
  aborting: 'settings.rag_migration_aborting',
  abortedConsecutiveFailures: 'settings.rag_migration_aborted_consecutive',
  cancelled: 'settings.rag_migration_cancelled'
} as const

export type RagMigrationStatusKey = (typeof RAG_MIGRATION_STATUS)[keyof typeof RAG_MIGRATION_STATUS]
