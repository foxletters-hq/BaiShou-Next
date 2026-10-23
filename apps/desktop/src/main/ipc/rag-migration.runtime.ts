import type { IpcMainInvokeEvent } from 'electron'
import type { EmbeddingMigrationRollbackConfig, RagMigrationStatusKey } from '@baishou/shared'
import { buildMigrationStreamResult, logger } from '@baishou/shared'
import { getEmbeddingConfig } from './rag.ipc'
import { DesktopEmbeddingStorage } from './rag.storage'
import { settingsManager } from './settings.ipc'
import { getEmbeddingMigrationStateService } from '../services/embedding-migration-state.service'
import { isRagMigrationStreamTerminal } from './rag-build.util'

export async function restoreInterruptedMigration(): Promise<number> {
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

export async function runMigrationStream(
  event: IpcMainInvokeEvent,
  generator: AsyncGenerator<any, void, unknown>
): Promise<ReturnType<typeof buildMigrationStreamResult>> {
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
    const terminal = isRagMigrationStreamTerminal(state.statusKey, Boolean(state.aborted))
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

export async function resolveRollbackConfig(
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
