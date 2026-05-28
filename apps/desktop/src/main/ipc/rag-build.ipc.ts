import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { memoryEmbeddingsTable } from '@baishou/database-desktop'
import type { EmbeddingMigrationRollbackConfig } from '@baishou/shared'
import { getAppDb } from '../db'
import { eq, sql } from 'drizzle-orm'
import { getDiaryManager } from './diary.ipc'
import { getEmbeddingService, getEmbeddingConfig, filterUnindexedDiaries } from './rag.ipc'
import { DesktopEmbeddingStorage } from './rag.storage'
import { settingsManager } from './settings.ipc'
import { getEmbeddingMigrationStateService } from '../services/embedding-migration-state.service'
import { limitExecute, resolveBatchEmbedConcurrency, toSerializableAiError } from '@baishou/shared'

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
): Promise<{ aborted: boolean }> {
  const config = getEmbeddingConfig()
  let aborted = false
  for await (const state of generator) {
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
  return { aborted }
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
      const db = getAppDb()
      const diaries = await getDiaryManager().listAll({ limit: 10000 })

      const existingRows = await db
        .select({
          sourceId: memoryEmbeddingsTable.sourceId,
          metadataJson: memoryEmbeddingsTable.metadataJson
        })
        .from(memoryEmbeddingsTable)
        .where(eq(memoryEmbeddingsTable.sourceType, 'diary'))

      const embeddedIds = new Set(existingRows.map((row) => row.sourceId))
      const embeddedUpdatedAtMap = new Map<string, number>()

      for (const row of existingRows) {
        if (!row.metadataJson) continue
        try {
          const meta = JSON.parse(row.metadataJson)
          if (meta && typeof meta.updated_at === 'number') {
            const currentMax = embeddedUpdatedAtMap.get(row.sourceId) ?? 0
            if (meta.updated_at > currentMax) {
              embeddedUpdatedAtMap.set(row.sourceId, meta.updated_at)
            }
          }
        } catch {}
      }

      const diariesToEmbed = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap)
      const total = diariesToEmbed.length
      const ragConfig =
        (await settingsManager.get<{ batchEmbedConcurrency?: number }>('rag_config')) || {}
      const batchConcurrency = resolveBatchEmbedConcurrency(ragConfig.batchEmbedConcurrency)

      if (total > 0) {
        await embeddingService.prepareEmbeddingIndex()
      }

      let completed = 0
      const reportProgress = (statusText: string) => {
        event.sender.send('agent:rag-progress', {
          isRunning: true,
          type: 'batchEmbed',
          progress: completed,
          total,
          statusText
        })
      }

      await limitExecute(diariesToEmbed, batchConcurrency, async (meta) => {
        const dateLabel = new Date(meta.date).toLocaleDateString()
        reportProgress(`处理日记: ${dateLabel}`)

        const diary = await getDiaryManager().findById(meta.id)
        if (!diary?.id || !diary.content?.trim()) {
          completed++
          reportProgress(`处理日记: ${dateLabel}`)
          return
        }

        const d = meta.date
        const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const tagPrefix = meta.tags.length > 0 ? `[标签: ${meta.tags.join(', ')}] ` : ''

        await embeddingService.reEmbedText({
          text: diary.content,
          sourceType: 'diary',
          sourceId: diary.id.toString(),
          groupId: 'diary_batch',
          chunkPrefix: `${tagPrefix}[${label} 日记:]\n`,
          metadataJson: JSON.stringify({ updated_at: diary.updatedAt?.getTime() ?? Date.now() }),
          sourceCreatedAt: diary.date.getTime(),
          skipIndexPrep: true
        })

        completed++
        reportProgress(`处理日记: ${dateLabel}`)
      })

      event.sender.send('agent:rag-progress', {
        isRunning: false,
        progress: total,
        total,
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
      await migrationStateService.reconcile()
      const rollbackConfig = await resolveRollbackConfig(options?.rollbackConfig)
      try {
        const result = await runMigrationStream(
          event,
          embeddingService.migrateEmbeddings(rollbackConfig)
        )
        return result
      } catch (e: unknown) {
        console.error('Migration failed:', e)
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
