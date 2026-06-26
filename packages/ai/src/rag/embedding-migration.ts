import { embed } from 'ai'
import {
  logger,
  RAG_MIGRATION_STATUS,
  mapMigrationBackupRow,
  assertMigrationBackupRow,
  type EmbeddingMigrationRollbackConfig
} from '@baishou/shared'
import type { IEmbeddingConfig, IEmbeddingStorage, MigrationProgress } from './embedding.types'
import { normalizeEmbeddingVector } from './embedding-chunk'
import { MigrationControl, MigrationAbortError, MIGRATION_CONSECUTIVE_FAILURE_LIMIT } from './migration-control'

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
}

type BackupChunkRow = Record<string, unknown>

const BACKUP_TABLE_MISSING = 'migration_backup_table_missing'

function getAbortGenerator(
  deps: EmbeddingMigrationDeps,
  control: MigrationControl,
  total: number,
  completed: number,
  failed: number
): AsyncGenerator<MigrationProgress, void, unknown> | null {
  if (!control.isAborted) return null
  return abortMigration(deps, total, completed, failed, RAG_MIGRATION_STATUS.cancelled)
}

function isMigrationAbortError(error: unknown): boolean {
  return error instanceof MigrationAbortError
}

function isBackupTableMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.message === BACKUP_TABLE_MISSING) return true
  if (error.message.includes(BACKUP_TABLE_MISSING)) return true
  const cause = (error as { cause?: unknown }).cause
  if (cause instanceof Error && cause.message.includes('no such table: memory_embeddings_backup')) {
    return true
  }
  return error.message.includes('no such table: memory_embeddings_backup')
}

function normalizeBackupChunk(chunk: BackupChunkRow) {
  return assertMigrationBackupRow(mapMigrationBackupRow(chunk))
}

export async function* migrateEmbeddings(
  deps: EmbeddingMigrationDeps,
  isMigratingRef: { current: boolean },
  control: MigrationControl
): AsyncGenerator<MigrationProgress, void, unknown> {
  if (isMigratingRef.current) {
    yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.alreadyRunning }
    return
  }
  isMigratingRef.current = true
  control.reset()
  try {
    if (!deps.isConfigured) {
      yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.modelNotConfigured }
      return
    }
    const modelId = deps.config.getGlobalEmbeddingModelId()
    let provider: Awaited<ReturnType<typeof deps.config.getProviderInstance>>
    try {
      provider = await deps.config.getProviderInstance()
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code
      if (code === 'api_key_missing') {
        yield {
          total: 0,
          completed: 0,
          statusKey: RAG_MIGRATION_STATUS.apiKeyMissing,
          statusParams: {
            providerId: deps.config.getGlobalEmbeddingProviderId(),
            modelId
          }
        }
        return
      }
      if (code === 'provider_not_found') {
        yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.providerNotFound }
        return
      }
      throw e
    }
    if (!provider) {
      yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.providerNotFound }
      return
    }

    const clientModel = provider.getEmbeddingModel(modelId)

    yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.backingUp }
    const rollbackCount = await deps.db.createRollbackSnapshot()
    const earlyAbort = getAbortGenerator(deps, control, 0, 0, 0)
    if (earlyAbort) {
      yield* earlyAbort
      return
    }
    if (rollbackCount === 0) {
      await deps.db.dropRollbackSnapshot()
      await deps.lifecycle?.markIdle()
      yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.noData }
      return
    }

    const total = await deps.db.createMigrationBackup()
    const backupAbort = getAbortGenerator(deps, control, total, 0, 0)
    if (backupAbort) {
      yield* backupAbort
      return
    }
    if (total === 0) {
      await deps.db.dropMigrationBackup()
      await deps.db.dropRollbackSnapshot()
      await deps.lifecycle?.markIdle()
      yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.noData }
      return
    }

    await deps.lifecycle?.markInProgress(deps.rollbackConfig)

    yield { total, completed: 0, statusKey: RAG_MIGRATION_STATUS.detectingDimension }
    const dimAbort = getAbortGenerator(deps, control, total, 0, 0)
    if (dimAbort) {
      yield* dimAbort
      return
    }
    let newDimension = 0
    try {
      const { embedding } = await embed({ model: clientModel, value: 'hi' })
      newDimension = embedding.length
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error('Dimension check failed during migration', { error: e, message })
      await deps.db.dropMigrationBackup()
      await deps.db.dropRollbackSnapshot()
      await deps.lifecycle?.markIdle()
      yield {
        total,
        completed: 0,
        statusKey: RAG_MIGRATION_STATUS.dimensionCheckFailed,
        statusParams: { message }
      }
      return
    }

    if (newDimension <= 0) {
      await deps.db.dropMigrationBackup()
      await deps.db.dropRollbackSnapshot()
      await deps.lifecycle?.markIdle()
      yield {
        total,
        completed: 0,
        statusKey: RAG_MIGRATION_STATUS.dimensionCheckFailed,
        statusParams: { message: 'empty embedding response' }
      }
      return
    }

    await deps.db.clearAndReinitEmbeddings(newDimension)
    await deps.config.setGlobalEmbeddingDimension(newDimension)

    const reembedAbort = getAbortGenerator(deps, control, total, 0, 0)
    if (reembedAbort) {
      yield* reembedAbort
      return
    }

    yield* reEmbedFromBackup(deps, clientModel, modelId, total, control)
  } finally {
    isMigratingRef.current = false
  }
}

export async function* continueMigration(
  deps: EmbeddingMigrationDeps,
  isMigratingRef: { current: boolean },
  control: MigrationControl
): AsyncGenerator<MigrationProgress, void, unknown> {
  if (isMigratingRef.current) {
    yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.alreadyRunning }
    return
  }
  isMigratingRef.current = true
  control.reset()
  try {
    if (!deps.isConfigured) {
      yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.modelNotConfigured }
      return
    }
    const modelId = deps.config.getGlobalEmbeddingModelId()
    let provider: Awaited<ReturnType<typeof deps.config.getProviderInstance>>
    try {
      provider = await deps.config.getProviderInstance()
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code
      if (code === 'api_key_missing') {
        yield {
          total: 0,
          completed: 0,
          statusKey: RAG_MIGRATION_STATUS.apiKeyMissing,
          statusParams: {
            providerId: deps.config.getGlobalEmbeddingProviderId(),
            modelId
          }
        }
        return
      }
      if (code === 'provider_not_found') {
        yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.providerNotFound }
        return
      }
      throw e
    }
    if (!provider) {
      yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.providerNotFound }
      return
    }

    const clientModel = provider.getEmbeddingModel(modelId)
    const hasBackup = await deps.db.hasMigrationBackupTable()
    const remaining = hasBackup ? await deps.db.getUnmigratedCount() : 0

    if (!hasBackup) {
      if (await deps.db.hasMigrationRollbackTable()) {
        logger.error('[EmbeddingMigration] Resume requested but backup table is missing')
        await deps.lifecycle?.markInterrupted()
        yield {
          total: remaining,
          completed: 0,
          statusKey: RAG_MIGRATION_STATUS.backupLost,
          statusParams: { remaining }
        }
        return
      }
      await deps.db.dropRollbackSnapshot()
      await deps.lifecycle?.markCompleted()
      yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.finished }
      return
    }

    if (remaining === 0) {
      await deps.db.dropMigrationBackup()
      await deps.db.dropRollbackSnapshot()
      await deps.lifecycle?.markCompleted()
      yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.finished }
      return
    }

    await deps.lifecycle?.markInProgress(deps.rollbackConfig)

    yield* reEmbedFromBackup(deps, clientModel, modelId, remaining, control)
  } finally {
    isMigratingRef.current = false
  }
}

async function* abortMigration(
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

async function* reEmbedFromBackup(
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

          await deps.db.insertEmbedding({
            id: chunk.embeddingId,
            sourceType: chunk.sourceType,
            sourceId: chunk.sourceId,
            groupId: chunk.groupId,
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

function buildProgressState(total: number, completed: number, failed: number): MigrationProgress {
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

export { normalizeBackupChunk }
