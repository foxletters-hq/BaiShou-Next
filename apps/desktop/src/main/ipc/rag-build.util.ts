import { RAG_MIGRATION_STATUS } from '@baishou/shared'

const TERMINAL_MIGRATION_STATUS = new Set<string>([
  RAG_MIGRATION_STATUS.complete,
  RAG_MIGRATION_STATUS.finished,
  RAG_MIGRATION_STATUS.noData,
  RAG_MIGRATION_STATUS.verifyPartial,
  RAG_MIGRATION_STATUS.verifyStale,
  RAG_MIGRATION_STATUS.verifyBoth,
  RAG_MIGRATION_STATUS.backupLost,
  RAG_MIGRATION_STATUS.alreadyRunning,
  RAG_MIGRATION_STATUS.modelNotConfigured,
  RAG_MIGRATION_STATUS.providerNotFound,
  RAG_MIGRATION_STATUS.apiKeyMissing,
  RAG_MIGRATION_STATUS.dimensionCheckFailed,
  RAG_MIGRATION_STATUS.cancelled,
  RAG_MIGRATION_STATUS.abortedConsecutiveFailures
])

export function newMemoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mem_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function isRagMigrationStreamTerminal(
  statusKey: string | undefined,
  aborted: boolean
): boolean {
  return aborted || Boolean(statusKey && TERMINAL_MIGRATION_STATUS.has(statusKey))
}
