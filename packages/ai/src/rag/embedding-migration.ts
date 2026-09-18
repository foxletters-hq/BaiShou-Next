import { embed } from 'ai'
import { logger, RAG_MIGRATION_STATUS } from '@baishou/shared'
import type { MigrationProgress } from './embedding.types'
import { MigrationControl } from './migration-control'
import type { EmbeddingMigrationDeps } from './embedding-migration.types'
import { rebuildEmbedLedgerAfterMigration } from './embedding-migration.helpers'
import { getAbortGenerator, reEmbedFromBackup } from './embedding-migration-reembed'

export type { EmbeddingMigrationDeps, MigrationLifecycle } from './embedding-migration.types'
export { normalizeBackupChunk } from './embedding-migration.helpers'

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
      const [, noStale] = await deps.db.verifyMigrationComplete(modelId)
      await rebuildEmbedLedgerAfterMigration(deps)
      await deps.db.dropRollbackSnapshot()
      if (!noStale) {
        await deps.lifecycle?.markInterrupted()
        yield {
          total: 0,
          completed: 0,
          statusKey: RAG_MIGRATION_STATUS.verifyStale
        }
        return
      }
      await deps.lifecycle?.markCompleted()
      yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.finished }
      return
    }

    if (remaining === 0) {
      const [allMigrated, noStale] = await deps.db.verifyMigrationComplete(modelId)
      await rebuildEmbedLedgerAfterMigration(deps)
      await deps.db.dropMigrationBackup()
      if (allMigrated && noStale) {
        await deps.db.dropRollbackSnapshot()
        await deps.lifecycle?.markCompleted()
        yield { total: 0, completed: 0, statusKey: RAG_MIGRATION_STATUS.finished }
        return
      }
      await deps.lifecycle?.markInterrupted()
      yield {
        total: 0,
        completed: 0,
        statusKey: !allMigrated
          ? !noStale
            ? RAG_MIGRATION_STATUS.verifyBoth
            : RAG_MIGRATION_STATUS.verifyPartial
          : RAG_MIGRATION_STATUS.verifyStale
      }
      return
    }

    await deps.lifecycle?.markInProgress(deps.rollbackConfig)

    yield* reEmbedFromBackup(deps, clientModel, modelId, remaining, control)
  } finally {
    isMigratingRef.current = false
  }
}
