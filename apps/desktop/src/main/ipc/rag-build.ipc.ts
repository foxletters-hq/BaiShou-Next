import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { memoryEmbeddingsTable } from '@baishou/database-desktop'
import type { EmbeddingMigrationRollbackConfig } from '@baishou/shared'
import { getAppDb } from '../db'
import { sql } from 'drizzle-orm'
import { getEmbeddingService, getEmbeddingConfig } from './rag.ipc'
import { DesktopEmbeddingStorage } from './rag.storage'
import { settingsManager } from './settings.ipc'
import { getEmbeddingMigrationStateService } from '../services/embedding-migration-state.service'
import { runControlledDiaryBatchEmbed } from '../services/controlled-diary-batch-embed.service'
import {
  buildMigrationStreamResult,
  logger,
  toSerializableAiError,
  type RagMigrationStatusKey,
  type RagMigrationStreamResult
} from '@baishou/shared'

async function restoreInterruptedMigration(): Promise<number> {
  const config = getEmbeddingConfig()
  const storage = new DesktopEmbeddingStorage()
  const stateService = getEmbeddingMigrationStateService()
  const state = await stateService.getState()

  if (!state.canRestore) {
    throw new Error('No migration rollback snapshot available')
  }

  await config.load()
  const count = await storage.restoreRollbackSnapshot()
  if (state.rollbackConfig && config.restoreEmbeddingModelConfig) {
    await config.restoreEmbeddingModelConfig(state.rollbackConfig)
  }
  await storage.dropMigrationBackup()
  await storage.dropRollbackSnapshot()
  await stateService.markIdle()
  await config.load()
  return count
}

async function runMigrationStream(
  event: IpcMainInvokeEvent,
  generator: AsyncGenerator<any, void, unknown>
): Promise<RagMigrationStreamResult> {
  const config = getEmbeddingConfig()
  let lastStatusKey: RagMigrationStatusKey | undefined
  let lastStatusParams: Record<string, string | number> | undefined
  let aborted = false
  for await (const state of generator) {
    if (state.statusKey) {
      lastStatusKey = state.statusKey as RagMigrationStatusKey
      lastStatusParams = state.statusParams
    }
    if (state.aborted) aborted = true
    event.sender.send('agent:rag-progress', {
      isRunning: !state.aborted,
      type: state.aborted ? 'idle' : 'migration',
      progress: state.completed,
      total: state.total,
      statusKey: state.statusKey,
      statusParams: state.statusParams,
      aborted: state.aborted,
      rollbackApplied: state.rollbackApplied
    })
  }
  event.sender.send('agent:rag-progress', {
    isRunning: false,
    progress: 0,
    total: 0,
    type: 'idle'
  })
  await config.load()

  const result = buildMigrationStreamResult(aborted, lastStatusKey, lastStatusParams)
  logger.info('[RAG] Migration stream finished', {
    outcome: result.outcome,
    statusKey: result.statusKey,
    statusParams: result.statusParams
  })
  return result
}

async function resolveRollbackConfig(
  explicit?: EmbeddingMigrationRollbackConfig
): Promise<EmbeddingMigrationRollbackConfig | undefined> {
  if (explicit?.globalEmbeddingModelId) return explicit

  const storage = new DesktopEmbeddingStorage()
  const meta = await storage.getCurrentEmbeddingMeta()
  if (!meta?.modelId) return undefined

  const globalModels = (await settingsManager.get<any>('global_models')) || {}
  return {
    globalEmbeddingProviderId: globalModels.globalEmbeddingProviderId || '',
    globalEmbeddingModelId: meta.modelId,
    globalEmbeddingDimension: meta.dimension || globalModels.globalEmbeddingDimension || 0
  }
}

export function registerRagBuildIPC() {
  const config = getEmbeddingConfig()
  const embeddingService = getEmbeddingService()
  const migrationStateService = getEmbeddingMigrationStateService()

  migrationStateService.setMigrationActiveChecker(() => embeddingService.isMigrationRunning())

  embeddingService.setMigrationLifecycle({
    markInProgress: (rollbackConfig) => migrationStateService.markInProgress(rollbackConfig),
    markCompleted: () => migrationStateService.markCompleted(),
    markInterrupted: () => migrationStateService.markInterrupted(),
    markIdle: () => migrationStateService.markIdle()
  })

  ipcMain.handle('rag:get-stats', async () => {
    await config.load()
    const db = getAppDb()
    const countRes = await db.select({ count: sql<number>`count(*)` }).from(memoryEmbeddingsTable)
    const count = countRes[0]?.count || 0

    return {
      totalCount: count,
      currentDimension: config.getGlobalEmbeddingDimension(),
      totalSizeText: `${(count * 2.5).toFixed(1)} KB` // Mock size calc for UI
    }
  })

  ipcMain.handle('rag:detect-dimension', async () => {
    await config.load()
    return await embeddingService.detectDimension()
  })

  ipcMain.handle('rag:clear-dimension', async () => {
    await config.load()
    const { DesktopEmbeddingStorage } = await import('./rag.storage')
    const storage = new DesktopEmbeddingStorage()
    await storage.clearEmbeddings()
    await config.setGlobalEmbeddingDimension(0)
    return true
  })

  ipcMain.handle('rag:clear-all', async () => {
    await config.load()
    const { DesktopEmbeddingStorage } = await import('./rag.storage')
    const storage = new DesktopEmbeddingStorage()
    await storage.clearEmbeddings()
    await config.setGlobalEmbeddingDimension(0)
    return true
  })

  ipcMain.handle('rag:trigger-batch-embed', async (event) => {
    await config.load()
    try {
      await runControlledDiaryBatchEmbed({
        groupId: 'diary_batch',
        onProgress: ({ completed, total, statusText }) => {
          event.sender.send('agent:rag-progress', {
            isRunning: true,
            type: 'batchEmbed',
            progress: completed,
            total,
            statusText
          })
        }
      })
      event.sender.send('agent:rag-progress', {
        isRunning: false,
        progress: 0,
        total: 0,
        type: 'idle'
      })
      return true
    } catch (e: unknown) {
      console.error('Batch Embed failed:', e)
      const err = toSerializableAiError(e, 'Batch embed failed')
      event.sender.send('agent:rag-progress', {
        isRunning: false,
        type: 'idle',
        progress: 0,
        total: 0,
        error: err.message
      })
      throw err
    }
  })

  ipcMain.handle('rag:add-manual-memory', async (_, text: string) => {
    await config.load()
    if (!text || !text.trim()) return false

    await embeddingService.embedText({
      text,
      sourceType: 'manual',
      sourceId: `manual_${Date.now()}`,
      groupId: 'manual',
      sourceCreatedAt: Date.now()
    })
    return true
  })

  ipcMain.handle(
    'rag:trigger-migration',
    async (event, options?: { rollbackConfig?: EmbeddingMigrationRollbackConfig }) => {
      await config.load()
      const migrationState = await migrationStateService.getState()
      const rollbackConfig =
        (await resolveRollbackConfig(options?.rollbackConfig)) ?? migrationState.rollbackConfig

      try {
        if (migrationState.canResume) {
          logger.info('[RAG] Resuming interrupted migration from backup')
          return await runMigrationStream(event, embeddingService.continueMigration(rollbackConfig))
        }

        return await runMigrationStream(event, embeddingService.migrateEmbeddings(rollbackConfig))
      } catch (e: unknown) {
        logger.error('[RAG] Migration failed with exception', { error: e })
        await migrationStateService.markInterrupted()
        const err = toSerializableAiError(e, 'Migration failed')
        event.sender.send('agent:rag-progress', {
          isRunning: false,
          type: 'idle',
          progress: 0,
          total: 0,
          error: err.message
        })
        throw err
      }
    }
  )

  ipcMain.handle('rag:resume-migration', async (event) => {
    await config.load()
    const state = await migrationStateService.getState()
    if (!state.canResume) {
      throw new Error('No resumable migration session found')
    }
    embeddingService.setMigrationLifecycle({
      markInProgress: (rollbackConfig) =>
        migrationStateService.markInProgress(rollbackConfig ?? state.rollbackConfig),
      markCompleted: () => migrationStateService.markCompleted(),
      markInterrupted: () => migrationStateService.markInterrupted(),
      markIdle: () => migrationStateService.markIdle()
    })
    try {
      return await runMigrationStream(
        event,
        embeddingService.continueMigration(state.rollbackConfig)
      )
    } catch (e: unknown) {
      console.error('Migration resume failed:', e)
      await migrationStateService.markInterrupted()
      const err = toSerializableAiError(e, 'Migration resume failed')
      event.sender.send('agent:rag-progress', {
        isRunning: false,
        type: 'idle',
        progress: 0,
        total: 0,
        error: err.message
      })
      throw err
    }
  })

  ipcMain.handle('rag:cancel-migration', async () => {
    embeddingService.requestMigrationAbort()
    return true
  })

  ipcMain.handle('rag:get-migration-state', async () => {
    await config.load()
    return await migrationStateService.getState()
  })

  ipcMain.handle('rag:restore-migration-backup', async () => {
    const count = await restoreInterruptedMigration()
    return { restoredCount: count }
  })

  ipcMain.handle('rag:has-pending-migration', async () => {
    await config.load()
    return await embeddingService.hasPendingMigration()
  })

  ipcMain.handle('rag:has-model-mismatch', async () => {
    await config.load()
    return await embeddingService.hasHeterogeneousEmbeddings()
  })
}
