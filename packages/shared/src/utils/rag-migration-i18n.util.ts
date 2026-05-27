import {
  RAG_MIGRATION_STATUS,
  type RagMigrationStatusKey
} from '../constants/rag-migration.constants'

type TranslateFn = (key: string, defaultValue?: string, options?: Record<string, unknown>) => string

const MIGRATION_STATUS_DEFAULTS: Record<RagMigrationStatusKey, string> = {
  [RAG_MIGRATION_STATUS.alreadyRunning]: 'A migration task is already running.',
  [RAG_MIGRATION_STATUS.modelNotConfigured]: 'Embedding model is not configured.',
  [RAG_MIGRATION_STATUS.providerNotFound]: 'Embedding provider not found.',
  [RAG_MIGRATION_STATUS.backingUp]: 'Backing up metadata...',
  [RAG_MIGRATION_STATUS.noData]: 'No data to migrate.',
  [RAG_MIGRATION_STATUS.detectingDimension]: 'Detecting new model dimension...',
  [RAG_MIGRATION_STATUS.dimensionCheckFailed]:
    'Failed to detect the new model dimension. Migration aborted.',
  [RAG_MIGRATION_STATUS.reembedding]: 'Re-embedding memories...',
  [RAG_MIGRATION_STATUS.inProgress]: '{{completed}}/{{total}} re-embedded',
  [RAG_MIGRATION_STATUS.inProgressWithFailures]:
    '{{completed}}/{{total}} re-embedded ({{failed}} failed)',
  [RAG_MIGRATION_STATUS.complete]: 'Migration complete ✅ {{completed}}/{{total}}',
  [RAG_MIGRATION_STATUS.verifyPartial]:
    'Migration finished with warnings ⚠️ Some chunks were not migrated ({{completed}}/{{total}}).',
  [RAG_MIGRATION_STATUS.verifyStale]:
    'Migration finished with warnings ⚠️ Stale model data remains ({{completed}}/{{total}}).',
  [RAG_MIGRATION_STATUS.verifyBoth]:
    'Migration finished with warnings ⚠️ Some chunks were not migrated and stale data remains ({{completed}}/{{total}}).',
  [RAG_MIGRATION_STATUS.finished]: 'Migration finished.',
  [RAG_MIGRATION_STATUS.aborting]:
    'Migration failed. Restoring previous embeddings and model settings...',
  [RAG_MIGRATION_STATUS.abortedConsecutiveFailures]:
    'Migration stopped after {{limit}} consecutive failures. Previous data and embedding model have been restored.',
  [RAG_MIGRATION_STATUS.cancelled]:
    'Migration cancelled. Previous data and embedding model have been restored.'
}

export function resolveMigrationStatusText(
  t: TranslateFn,
  statusKey?: string,
  statusParams?: Record<string, string | number>
): string {
  if (!statusKey) return ''
  const defaultValue = MIGRATION_STATUS_DEFAULTS[statusKey as RagMigrationStatusKey] ?? statusKey
  return t(statusKey, defaultValue, statusParams)
}
