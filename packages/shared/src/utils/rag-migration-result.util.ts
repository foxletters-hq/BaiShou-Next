import {
  RAG_MIGRATION_STATUS,
  type RagMigrationStatusKey
} from '../constants/rag-migration.constants'

export type RagMigrationOutcome = 'completed' | 'aborted' | 'interrupted' | 'failed' | 'no_data'

export interface RagMigrationStreamResult {
  aborted: boolean
  completed: boolean
  /** True only when migration stopped mid-flight and backup tables may remain. */
  interrupted: boolean
  /** True when migration failed before completion without a resumable partial state. */
  failed: boolean
  outcome: RagMigrationOutcome
  statusKey?: RagMigrationStatusKey
  statusParams?: Record<string, string | number>
}

const INTERRUPTED_STATUS_KEYS = new Set<RagMigrationStatusKey>([
  RAG_MIGRATION_STATUS.verifyPartial,
  RAG_MIGRATION_STATUS.verifyStale,
  RAG_MIGRATION_STATUS.verifyBoth
])

const FAILURE_STATUS_KEYS = new Set<RagMigrationStatusKey>([
  RAG_MIGRATION_STATUS.alreadyRunning,
  RAG_MIGRATION_STATUS.modelNotConfigured,
  RAG_MIGRATION_STATUS.providerNotFound,
  RAG_MIGRATION_STATUS.apiKeyMissing,
  RAG_MIGRATION_STATUS.dimensionCheckFailed
])

export function buildMigrationStreamResult(
  aborted: boolean,
  lastStatusKey?: RagMigrationStatusKey,
  statusParams?: Record<string, string | number>
): RagMigrationStreamResult {
  if (aborted) {
    return {
      aborted: true,
      completed: false,
      interrupted: false,
      failed: false,
      outcome: 'aborted',
      statusKey: lastStatusKey ?? RAG_MIGRATION_STATUS.cancelled,
      statusParams
    }
  }

  if (
    lastStatusKey === RAG_MIGRATION_STATUS.complete ||
    lastStatusKey === RAG_MIGRATION_STATUS.finished
  ) {
    return {
      aborted: false,
      completed: true,
      interrupted: false,
      failed: false,
      outcome: 'completed',
      statusKey: lastStatusKey,
      statusParams
    }
  }

  if (lastStatusKey === RAG_MIGRATION_STATUS.noData) {
    return {
      aborted: false,
      completed: false,
      interrupted: false,
      failed: false,
      outcome: 'no_data',
      statusKey: lastStatusKey,
      statusParams
    }
  }

  if (lastStatusKey && INTERRUPTED_STATUS_KEYS.has(lastStatusKey)) {
    return {
      aborted: false,
      completed: false,
      interrupted: true,
      failed: false,
      outcome: 'interrupted',
      statusKey: lastStatusKey,
      statusParams
    }
  }

  if (lastStatusKey && FAILURE_STATUS_KEYS.has(lastStatusKey)) {
    return {
      aborted: false,
      completed: false,
      interrupted: false,
      failed: true,
      outcome: 'failed',
      statusKey: lastStatusKey,
      statusParams
    }
  }

  return {
    aborted: false,
    completed: false,
    interrupted: false,
    failed: true,
    outcome: 'failed',
    statusKey: lastStatusKey,
    statusParams
  }
}

export function isResumableMigrationFailure(result: RagMigrationStreamResult): boolean {
  return result.outcome === 'interrupted'
}
