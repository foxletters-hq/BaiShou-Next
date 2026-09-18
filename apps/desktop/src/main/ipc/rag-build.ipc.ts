import { ipcMain, BrowserWindow } from 'electron'
import { memoryEmbeddingsTable } from '@baishou/database-desktop'
import type { EmbeddingMigrationRollbackConfig, MemoryRawRecord } from '@baishou/shared'
import { getAppDb, setAppDbResetBlocker } from '../db'
import { sql } from 'drizzle-orm'
import { getEmbeddingService, getEmbeddingConfig } from './rag.ipc'
import { vaultService, resolveActiveVaultId } from './vault.ipc'
import { getMemoryRawManager, getRawDataSourceManager } from '../services/raw-data-source.runtime'
import { countDiaryEmbeddingsForVault } from '../services/diary-embedding.util'
import { getEmbeddingMigrationStateService } from '../services/embedding-migration-state.service'
import {
  buildMemoryMetadataJson,
  logger,
  MEMORY_EMBED_GROUP_ID,
  MEMORY_SOURCE_TYPE,
  RAG_MIGRATION_STATUS,
  toSerializableAiError,
  memoryClearVectorKindsOf,
  parseMemoryClearKinds,
  shouldTombstoneMemoryRecord,
  type MemoryClearKind
} from '@baishou/shared'
import { newMemoryId } from './rag-build.util'
import { registerRagBatchEmbedIpc } from './rag-batch-embed.ipc'
import {
  resolveRollbackConfig,
  restoreInterruptedMigration,
  runMigrationStream
} from './rag-migration.runtime'

/** Rewrite Memory shards as collapsed tombstones so selected clear cannot revive. */
async function tombstoneMemoryShards(kinds: readonly MemoryClearKind[]): Promise<void> {
  if (!kinds.includes('partner') && !kinds.includes('manual')) return
  const memoryMgr = getMemoryRawManager()
  const now = Date.now()
  for (const shard of await memoryMgr.listShards()) {
    const rows = await memoryMgr.readCollapsedShard(shard.shardMonth)
    if (rows.length === 0) continue
    let changed = false
    const next = rows.map((row) => {
      if (row.deletedAt != null || !shouldTombstoneMemoryRecord(kinds, row)) return row
      changed = true
      return {
        ...row,
        updatedAt: now,
        deletedAt: now
      }
    })
    if (!changed) continue
    const content = `${next.map((row) => JSON.stringify(row)).join('\n')}\n`
    await memoryMgr.replaceShardContent(shard.shardMonth, content)
  }
}

export function registerRagBuildIPC() {
  const config = getEmbeddingConfig()
  const embeddingService = getEmbeddingService()
  const migrationStateService = getEmbeddingMigrationStateService()

  migrationStateService.setMigrationActiveChecker(() => embeddingService.isMigrationRunning())
  setAppDbResetBlocker(() => embeddingService.isMigrationRunning())

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
    const activeVaultName = vaultService.getActiveVault()?.name ?? 'Personal'
    const activeVaultId = resolveActiveVaultId()
    const diaryCountForVault = await countDiaryEmbeddingsForVault(activeVaultId)

    return {
      totalCount: count,
      diaryCountForVault,
      activeVaultName,
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
    const { invalidatePendingEmbedCountsCache } =
      await import('../services/pending-embed-counts.service')
    invalidatePendingEmbedCountsCache()
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('diary:sync-event', { type: 'embed-pending-changed' })
    }
    return true
  })

  ipcMain.handle('rag:clear-all', async (_event, opts?: { kinds?: unknown }) => {
    await config.load()
    const kinds = parseMemoryClearKinds(opts?.kinds)
    const vectorKinds = memoryClearVectorKindsOf(kinds)
    await tombstoneMemoryShards(kinds)
    const { DesktopEmbeddingStorage } = await import('./rag.storage')
    const storage = new DesktopEmbeddingStorage()
    if (vectorKinds.length > 0) {
      await storage.clearEmbeddingsByKinds(vectorKinds)
    }
    if ((await storage.countEmbeddings()) === 0) {
      await config.setGlobalEmbeddingDimension(0)
    }
    const { invalidatePendingEmbedCountsCache } =
      await import('../services/pending-embed-counts.service')
    invalidatePendingEmbedCountsCache()
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('diary:sync-event', { type: 'embed-pending-changed' })
    }
    return true
  })

  registerRagBatchEmbedIpc()

  ipcMain.handle('rag:embed-jobs-pending-count', async () => {
    const { getDiaryEmbedJobsPendingCount } =
      await import('../services/diary-embed-jobs-consumer.service')
    return getDiaryEmbedJobsPendingCount()
  })

  /** 当前活跃仓待嵌入日记篇数（底栏「待嵌入」用） */
  ipcMain.handle('rag:unindexed-diary-count', async () => {
    const { getPendingEmbedCountsForActiveVault } =
      await import('../services/pending-embed-counts.service')
    const counts = await getPendingEmbedCountsForActiveVault()
    return counts.diaries
  })

  ipcMain.handle('rag:pending-embed-counts', async () => {
    const { getPendingEmbedCountsForActiveVault } =
      await import('../services/pending-embed-counts.service')
    return getPendingEmbedCountsForActiveVault()
  })

  ipcMain.handle('rag:add-manual-memory', async (_, text: string) => {
    await config.load()
    if (!text || !text.trim()) return false

    const now = Date.now()
    const id = newMemoryId()
    const vaultName = vaultService.getActiveVault()?.name ?? 'Personal'
    const vaultId = resolveActiveVaultId()
    const content = text.trim()
    const record: MemoryRawRecord = {
      id,
      schemaVersion: 1,
      vaultId,
      vaultName,
      content,
      tags: [],
      sourceSessionId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }

    const rawManager = getRawDataSourceManager()
    const written = await rawManager.writeRecord('memory', record)
    await embeddingService.embedText({
      text: content,
      sourceType: MEMORY_SOURCE_TYPE,
      sourceId: id,
      groupId: MEMORY_EMBED_GROUP_ID,
      vaultId,
      metadataJson: buildMemoryMetadataJson(record),
      sourceCreatedAt: now
    })
    const memoryMgr = rawManager.getMemoryManager()
    if (memoryMgr) {
      await memoryMgr.commitIndexed(written.relativePath, written.contentHash)
    }
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

    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('agent:rag-progress', {
        isRunning: true,
        type: 'migration',
        statusKey: RAG_MIGRATION_STATUS.aborting
      })
    }

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
