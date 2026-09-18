import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { memoryEmbeddingsTable } from '@baishou/database-desktop'
import type { EmbeddingMigrationRollbackConfig, MemoryRawRecord } from '@baishou/shared'
import { getAppDb, setAppDbResetBlocker } from '../db'
import { sql } from 'drizzle-orm'
import { getEmbeddingService, getEmbeddingConfig } from './rag.ipc'
import { DesktopEmbeddingStorage } from './rag.storage'
import { settingsManager } from './settings.ipc'
import { vaultService, resolveActiveVaultId } from './vault.ipc'
import { getMemoryRawManager, getRawDataSourceManager } from '../services/raw-data-source.runtime'
import { countDiaryEmbeddingsForVault } from '../services/diary-embedding.util'
import { getEmbeddingMigrationStateService } from '../services/embedding-migration-state.service'
import {
  beginBatchEmbedControl,
  endBatchEmbedControl,
  isBatchEmbedAbortRequested,
  isBatchEmbedAbortedError,
  isBatchEmbedPaused,
  isBatchEmbedSessionActive,
  requestBatchEmbedCancel,
  requestBatchEmbedPause,
  requestBatchEmbedResume
} from '../services/batch-embed-control.service'
import { runControlledDiaryBatchEmbed } from '../services/controlled-diary-batch-embed.service'
import {
  buildMemoryMetadataJson,
  buildMigrationStreamResult,
  clearRagDiaryEmbedFailure,
  hasRagDiaryEmbedFailure,
  markRagDiaryEmbedFailure,
  logger,
  MEMORY_EMBED_GROUP_ID,
  MEMORY_SOURCE_TYPE,
  RAG_MIGRATION_STATUS,
  toSerializableAiError,
  applyFrozenPhaseProgress,
  firstActivePhase,
  memoryClearVectorKindsOf,
  overallFromPhaseCounts,
  parseMemoryClearKinds,
  patchPhaseCounts,
  phaseCountsFromPending,
  shouldTombstoneMemoryRecord,
  type MemoryClearKind,
  type RagBatchEmbedPhaseCounts,
  type RagBatchEmbedPhaseKind,
  type RagConfig,
  type RagMigrationStatusKey,
  type RagMigrationStreamResult
} from '@baishou/shared'

function newMemoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mem_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

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
    const terminal =
      state.aborted ||
      state.statusKey === RAG_MIGRATION_STATUS.complete ||
      state.statusKey === RAG_MIGRATION_STATUS.finished ||
      state.statusKey === RAG_MIGRATION_STATUS.noData ||
      state.statusKey === RAG_MIGRATION_STATUS.verifyPartial ||
      state.statusKey === RAG_MIGRATION_STATUS.verifyStale ||
      state.statusKey === RAG_MIGRATION_STATUS.verifyBoth ||
      state.statusKey === RAG_MIGRATION_STATUS.backupLost ||
      state.statusKey === RAG_MIGRATION_STATUS.alreadyRunning ||
      state.statusKey === RAG_MIGRATION_STATUS.modelNotConfigured ||
      state.statusKey === RAG_MIGRATION_STATUS.providerNotFound ||
      state.statusKey === RAG_MIGRATION_STATUS.apiKeyMissing ||
      state.statusKey === RAG_MIGRATION_STATUS.dimensionCheckFailed ||
      state.statusKey === RAG_MIGRATION_STATUS.cancelled ||
      state.statusKey === RAG_MIGRATION_STATUS.abortedConsecutiveFailures
    event.sender.send('agent:rag-progress', {
      isRunning: !terminal,
      type: terminal ? 'idle' : 'migration',
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

  type BatchProgressExtras = {
    running?: boolean
    phase?: RagBatchEmbedPhaseKind
    phases?: RagBatchEmbedPhaseCounts
  }
  const lastBatchProgress: {
    current: {
      progress: number
      total: number
      statusText: string
      extras?: BatchProgressExtras
    } | null
  } = { current: null }

  const sendBatchProgress = (
    progress: number,
    total: number,
    statusText: string,
    extras?: BatchProgressExtras
  ) => {
    lastBatchProgress.current = { progress, total, statusText, extras }
    const running = extras?.running ?? true
    const payload = {
      isRunning: running,
      type: running ? 'batchEmbed' : 'idle',
      progress,
      total,
      statusText,
      phase: extras?.phase,
      phases: extras?.phases,
      paused: running && isBatchEmbedPaused(),
      cancelling: running && isBatchEmbedAbortRequested()
    }
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('agent:rag-progress', payload)
    }
  }

  const replayLastBatchProgress = (statusText?: string) => {
    const last = lastBatchProgress.current
    if (last) {
      sendBatchProgress(last.progress, last.total, statusText ?? last.statusText, last.extras)
      return
    }
    sendBatchProgress(0, 0, statusText ?? '正在补齐嵌入…', {
      running: true,
      phase: 'starting'
    })
  }

  ipcMain.handle('rag:pause-batch-embed', async () => {
    requestBatchEmbedPause()
    replayLastBatchProgress()
    return { ok: true }
  })

  ipcMain.handle('rag:resume-batch-embed', async () => {
    requestBatchEmbedResume()
    replayLastBatchProgress()
    return { ok: true }
  })

  ipcMain.handle('rag:cancel-batch-embed', async () => {
    requestBatchEmbedCancel()
    replayLastBatchProgress('正在取消索引…')
    return { ok: true }
  })

  ipcMain.handle('rag:trigger-batch-embed', async (_event) => {
    if (isBatchEmbedSessionActive()) {
      return { ok: false, alreadyRunning: true }
    }
    beginBatchEmbedControl()
    await config.load()
    const sendProgress = sendBatchProgress
    const notifyPendingChanged = (() => {
      let lastAt = 0
      return (force = false) => {
        const now = Date.now()
        if (!force && now - lastAt < 800) return
        lastAt = now
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('diary:sync-event', { type: 'embed-pending-changed' })
        }
      }
    })()

    try {
      const { getOrganizePendingSnapshot, invalidatePendingEmbedCountsCache } =
        await import('../services/pending-embed-counts.service')
      invalidatePendingEmbedCountsCache()
      sendProgress(0, 1, '正在开始索引…', { phase: 'starting' })
      const counts = await getOrganizePendingSnapshot()
      let phases = phaseCountsFromPending(counts)
      const overallTotal = overallFromPhaseCounts(phases).total
      sendProgress(0, overallTotal, '正在开始索引…', {
        phase: firstActivePhase(counts),
        phases
      })

      const diaryResult = await runControlledDiaryBatchEmbed({
        groupId: 'diary_batch',
        onProgress: ({ completed, total, statusText }) => {
          phases = applyFrozenPhaseProgress(phases, 'diary', {
            completed,
            total
          })
          const overall = overallFromPhaseCounts(phases)
          sendProgress(overall.completed, overall.total, statusText || '正在嵌入日记…', {
            phase: 'diary',
            phases
          })
        }
      })
      phases = patchPhaseCounts(phases, 'diary', {
        completed: diaryResult.embedded,
        total: diaryResult.total
      })

      if (diaryResult.failed > 0 && diaryResult.embedded === 0 && diaryResult.total > 0) {
        const ragConfig = (await settingsManager.get<RagConfig>('rag_config')) || ({} as RagConfig)
        const message =
          diaryResult.lastError || '嵌入接口不可用，没有写入任何日记向量。请检查嵌入模型的接口地址。'
        await settingsManager.set('rag_config', markRagDiaryEmbedFailure(ragConfig, message))
        throw new Error(message)
      }

      const { runManualPendingEmbedFill } = await import('../services/pending-embed-fill.service')
      const fillResult = await runManualPendingEmbedFill({
        counts,
        onProgress: ({ completed, total, statusText, phase, phases: nextPhases }) => {
          phases = nextPhases
          sendProgress(completed, total, statusText, { phase, phases: nextPhases })
          notifyPendingChanged()
        }
      })

      if (
        fillResult.skippedReason === 'adapter-unavailable' &&
        counts.total > counts.diaries
      ) {
        throw new Error('嵌入模型未就绪，无法补齐记忆、图谱节点和知识库')
      }

      invalidatePendingEmbedCountsCache()
      notifyPendingChanged(true)
      const ragConfig = (await settingsManager.get<RagConfig>('rag_config')) || ({} as RagConfig)
      if (diaryResult.failed === 0 && hasRagDiaryEmbedFailure(ragConfig)) {
        await settingsManager.set('rag_config', clearRagDiaryEmbedFailure(ragConfig))
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('diary:sync-event', { type: 'embed-failure-cleared' })
        }
      }

      const finished = overallFromPhaseCounts(phases)
      sendProgress(finished.completed, finished.total, '', {
        running: false,
        phase: 'finishing',
        phases
      })
      return {
        ok: true,
        graphUpdated: fillResult.graphUpdated,
        graphFailed: fillResult.graphFailed,
        graphTotal: fillResult.graphTotal
      }
    } catch (e: unknown) {
      if (isBatchEmbedAbortedError(e)) {
        try {
          const { invalidatePendingEmbedCountsCache } =
            await import('../services/pending-embed-counts.service')
          invalidatePendingEmbedCountsCache()
        } catch {
          // ignore
        }
        notifyPendingChanged(true)
        endBatchEmbedControl()
        const cancelledProgress = lastBatchProgress.current
        sendProgress(
          cancelledProgress?.progress ?? 0,
          cancelledProgress?.total ?? 0,
          '',
          {
            running: false,
            phase: cancelledProgress?.extras?.phase,
            phases: cancelledProgress?.extras?.phases
          }
        )
        return { ok: true, cancelled: true }
      }
      console.error('Batch Embed failed:', e)
      const err = toSerializableAiError(e, 'Batch embed failed')
      endBatchEmbedControl()
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('agent:rag-progress', {
          isRunning: false,
          type: 'idle',
          progress: 0,
          total: 0,
          paused: false,
          cancelling: false,
          error: err.message
        })
      }
      throw err
    } finally {
      endBatchEmbedControl()
    }
  })

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
