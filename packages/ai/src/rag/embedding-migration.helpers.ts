import {
  logger,
  RAG_MIGRATION_STATUS,
  mapMigrationBackupRow,
  assertMigrationBackupRow,
  inferVaultNameFromEmbeddingRefs,
  deriveLegacyVaultId,
  isVaultId,
  type EmbeddingMigrationRollbackConfig
} from '@baishou/shared'
import type { MigrationProgress } from './embedding.types'
import { MigrationAbortError } from './migration-control'
import type { EmbeddingMigrationDeps } from './embedding-migration.types'

export type BackupChunkRow = Record<string, unknown>

export const BACKUP_TABLE_MISSING = 'migration_backup_table_missing'

export async function rebuildEmbedLedgerAfterMigration(
  deps: EmbeddingMigrationDeps
): Promise<void> {
  if (!deps.db.rebuildEmbedLedger) return
  try {
    await deps.db.rebuildEmbedLedger({
      onRebuilt: deps.lifecycle?.invalidateIndexedHashes
    })
  } catch (e) {
    logger.warn('[EmbeddingMigration] 迁移结束后重建 embed_ledger 失败', { error: e })
  }
}

export function resolveMigrationVaultId(chunk: {
  groupId: string
  sourceType: string
  sourceId: string
  vaultName?: string | null
}): string {
  const raw = chunk.vaultName?.trim()
  if (raw) {
    return isVaultId(raw) ? raw : deriveLegacyVaultId(raw)
  }
  const inferred = inferVaultNameFromEmbeddingRefs({
    groupId: chunk.groupId,
    sourceType: chunk.sourceType,
    sourceId: chunk.sourceId,
    vaultName: chunk.vaultName
  })
  if (!inferred) return ''
  return isVaultId(inferred) ? inferred : deriveLegacyVaultId(inferred)
}

export function isMigrationAbortError(error: unknown): boolean {
  return error instanceof MigrationAbortError
}

export function isBackupTableMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.message === BACKUP_TABLE_MISSING) return true
  if (error.message.includes(BACKUP_TABLE_MISSING)) return true
  const cause = (error as { cause?: unknown }).cause
  if (cause instanceof Error && cause.message.includes('no such table: memory_embeddings_backup')) {
    return true
  }
  return error.message.includes('no such table: memory_embeddings_backup')
}

export function normalizeBackupChunk(chunk: BackupChunkRow) {
  return assertMigrationBackupRow(mapMigrationBackupRow(chunk))
}

export function buildProgressState(
  total: number,
  completed: number,
  failed: number
): MigrationProgress {
  if (failed > 0) {
    return {
      total,
      completed,
      failed,
      statusKey: RAG_MIGRATION_STATUS.inProgressWithFailures,
      statusParams: { completed, total, failed }
    }
  }
  return {
    total,
    completed,
    failed,
    statusKey: RAG_MIGRATION_STATUS.inProgress,
    statusParams: { completed, total }
  }
}

export type { EmbeddingMigrationRollbackConfig }
