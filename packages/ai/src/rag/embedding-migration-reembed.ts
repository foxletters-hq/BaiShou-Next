import { embed } from 'ai'
import { logger, RAG_MIGRATION_STATUS } from '@baishou/shared'
import type { MigrationProgress } from './embedding.types'
import { normalizeEmbeddingVector } from './embedding-chunk'
import { MigrationControl, MIGRATION_CONSECUTIVE_FAILURE_LIMIT } from './migration-control'
import type { EmbeddingMigrationDeps } from './embedding-migration.types'
import {
  BACKUP_TABLE_MISSING,
  buildProgressState,
  isBackupTableMissingError,
  isMigrationAbortError,
  normalizeBackupChunk,
  rebuildEmbedLedgerAfterMigration,
  resolveMigrationVaultId
} from './embedding-migration.helpers'

export async function* abortMigration(
  deps: EmbeddingMigrationDeps,
  total: number,
  completed: number,
  failed: number,
  statusKey: string,
  statusParams?: Record<string, string | number>
): AsyncGenerator<MigrationProgress, void, unknown> {
  yield {
    total,
    completed,
    failed,
    statusKey: RAG_MIGRATION_STATUS.aborting
  }

  try {
    const hasRollback = await deps.db.hasMigrationRollbackTable()
    if (hasRollback) {
      await deps.db.restoreRollbackSnapshot()
      if (deps.rollbackConfig && deps.config.restoreEmbeddingModelConfig) {
        await deps.config.restoreEmbeddingModelConfig(deps.rollbackConfig)
      }
    } else {
      logger.warn(
        '[EmbeddingMigration] Rollback snapshot missing during abort; skipping vector restore'
      )
    }

    if (await deps.db.hasMigrationBackupTable()) {
      await deps.db.dropMigrationBackup()
    }
    if (await deps.db.hasMigrationRollbackTable()) {
      await deps.db.dropRollbackSnapshot()
    }
  } catch (e) {
    logger.error('Failed to restore embedding migration rollback snapshot', { error: e })
  }

  await rebuildEmbedLedgerAfterMigration(deps)
  await deps.lifecycle?.markIdle()

  yield {
    total,
    completed,
    failed,
    statusKey,
    statusParams,
    aborted: true,
    rollbackApplied: true
  }
}

export function getAbortGenerator(
  deps: EmbeddingMigrationDeps,
  control: MigrationControl,
  total: number,
  completed: number,
  failed: number
): AsyncGenerator<MigrationProgress, void, unknown> | null {
  if (!control.isAborted) return null
  return abortMigration(deps, total, completed, failed, RAG_MIGRATION_STATUS.cancelled)
}

export async function* reEmbedFromBackup(
  deps: EmbeddingMigrationDeps,
  aiModel: any,
  modelId: string,
  total: number,
  control: MigrationControl
): AsyncGenerator<MigrationProgress, void, unknown> {
  yield { total, completed: 0, statusKey: RAG_MIGRATION_STATUS.reembedding }

  let completed = 0
  let failed = 0
  let consecutiveFailures = 0

  while (true) {
    if (control.isAborted) {
      yield* abortMigration(deps, total, completed, failed, RAG_MIGRATION_STATUS.cancelled)
      return
    }

    if (!(await deps.db.hasMigrationBackupTable())) {
      logger.error('[EmbeddingMigration] Backup table disappeared during re-embedding')
      await deps.lifecycle?.markInterrupted()
      yield {
        total,
        completed,
        failed,
        statusKey: RAG_MIGRATION_STATUS.backupLost,
        statusParams: { completed, total }
      }
      return
    }

    const chunks = await deps.db.getUnmigratedBackupChunks()
    if (chunks.length === 0) break

    for (const rawChunk of chunks) {
      if (control.isAborted) {
        yield* abortMigration(deps, total, completed, failed, RAG_MIGRATION_STATUS.cancelled)
        return
      }

      let chunk
      try {
        chunk = normalizeBackupChunk(rawChunk)
      } catch (e) {
        failed++
        consecutiveFailures++
        logger.error('Skipping invalid backup chunk during migration', { error: e, rawChunk })
        yield buildProgressState(total, completed, failed)
        if (consecutiveFailures >= MIGRATION_CONSECUTIVE_FAILURE_LIMIT) {
          yield* abortMigration(
            deps,
            total,
            completed,
            failed,
            RAG_MIGRATION_STATUS.abortedConsecutiveFailures,
            { limit: MIGRATION_CONSECUTIVE_FAILURE_LIMIT }
          )
          return
        }
        continue
      }

      try {
        await deps.retryEmbed(async () => {
          const { embedding } = await embed({
            model: aiModel,
            value: chunk.chunkText
          })

          const vaultId = resolveMigrationVaultId({
            groupId: chunk.groupId,
            sourceType: chunk.sourceType,
            sourceId: chunk.sourceId,
            vaultName: chunk.vaultName
          })
          if (!vaultId) {
            throw new Error(
              `migrate chunk ${chunk.embeddingId}: cannot infer vaultId (groupId=${chunk.groupId})`
            )
          }

          await deps.db.insertEmbedding({
            id: chunk.embeddingId,
            sourceType: chunk.sourceType,
            sourceId: chunk.sourceId,
            groupId: chunk.groupId,
            vaultId,
            chunkIndex: chunk.chunkIndex,
            chunkText: chunk.chunkText,
            metadataJson: chunk.metadataJson,
            embedding: normalizeEmbeddingVector(embedding),
            modelId,
            sourceCreatedAt: chunk.sourceCreatedAt
          })
        }, `migrate chunk ${chunk.embeddingId}`)

        if (!(await deps.db.hasMigrationBackupTable())) {
          throw new Error(BACKUP_TABLE_MISSING)
        }
        await deps.db.markBackupChunkMigrated(chunk.embeddingId)
        completed++
        consecutiveFailures = 0
      } catch (e) {
        if (isMigrationAbortError(e) || control.isAborted) {
          yield* abortMigration(deps, total, completed, failed, RAG_MIGRATION_STATUS.cancelled)
          return
        }
        failed++
        consecutiveFailures++
        logger.error(`Migration failed for chunk ${chunk.embeddingId}`, { error: e })
        if (isBackupTableMissingError(e)) {
          yield buildProgressState(total, completed, failed)
          await deps.lifecycle?.markInterrupted()
          yield {
            total,
            completed,
            failed,
            statusKey: RAG_MIGRATION_STATUS.backupLost,
            statusParams: { completed, total }
          }
          return
        }
        if (consecutiveFailures >= MIGRATION_CONSECUTIVE_FAILURE_LIMIT) {
          yield buildProgressState(total, completed, failed)
          yield* abortMigration(
            deps,
            total,
            completed,
            failed,
            RAG_MIGRATION_STATUS.abortedConsecutiveFailures,
            { limit: MIGRATION_CONSECUTIVE_FAILURE_LIMIT }
          )
          return
        }
      }

      yield buildProgressState(total, completed, failed)
    }
  }

  const [allMigrated, noStale] = await deps.db.verifyMigrationComplete(modelId)
  await rebuildEmbedLedgerAfterMigration(deps)

  if (allMigrated && noStale) {
    await deps.db.dropMigrationBackup()
    await deps.db.dropRollbackSnapshot()
    await deps.lifecycle?.markCompleted()
    yield {
      total,
      completed,
      failed,
      statusKey: RAG_MIGRATION_STATUS.complete,
      statusParams: { completed, total }
    }
  } else {
    await deps.lifecycle?.markInterrupted()
    const statusKey = !allMigrated
      ? !noStale
        ? RAG_MIGRATION_STATUS.verifyBoth
        : RAG_MIGRATION_STATUS.verifyPartial
      : RAG_MIGRATION_STATUS.verifyStale
    yield {
      total,
      completed,
      failed,
      statusKey,
      statusParams: { completed, total }
    }
  }
}
