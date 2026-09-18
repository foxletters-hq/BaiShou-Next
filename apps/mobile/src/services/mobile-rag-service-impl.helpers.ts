import i18n from 'i18next'
import { logger, type RagVectorKindFilter } from '@baishou/shared'
import { MobileRagAbortError, mobileRagOperationControl } from './mobile-rag-operation-control'
import { countDiaryEmbeddingsForVault } from './mobile-diary-embedding.util'
import {
  chainRagProgressCallback,
  resolveEmbeddingAdapter,
  resolveVaultScope,
  type MobileRagServiceDeps,
  type RagProgressCallback
} from './mobile-rag-core.helpers'
import {
  resolveControlledDiaryBatchEmbedCount,
  runControlledDiaryBatchEmbed,
  runControlledDiaryBatchEmbedCore
} from './mobile-rag-batch-embed.helpers'
import { isMobileRagBatchBusy, setReembedInFlight } from './mobile-rag-state.helpers'
import { HYBRID_SEARCH_TABLE, type RawSqlClient } from './mobile-rag-entry.helpers'
import { queryMobileRagEntries } from './mobile-rag-query.helpers'
import {
  addMobileManualMemory,
  clearAllMobileRag,
  deleteMobileRagEntry,
  editMobileRagEntry
} from './mobile-rag-memory-write.helpers'

export function createMobileRagService(deps: MobileRagServiceDeps) {
  const reembedAllInternal = async (onProgress?: RagProgressCallback): Promise<number> => {
    mobileRagOperationControl.reset()
    const reportReembedProgress = chainRagProgressCallback('reembed', onProgress)
    await deps.hsRepo.clearEmbeddings()

    if (mobileRagOperationControl.isAborted) {
      throw new MobileRagAbortError(0)
    }

    const globalModels = (await deps.settingsManager.get<any>('global_models')) || {}
    globalModels.globalEmbeddingDimension = 0
    await deps.settingsManager.set('global_models', globalModels)

    const ragConfig = (await deps.settingsManager.get<any>('rag_config')) || {}
    ragConfig.totalEmbeddings = 0
    await deps.settingsManager.set('rag_config', ragConfig)

    reportReembedProgress?.({ current: 0, total: 1, status: 'detect-dimension' })
    if (mobileRagOperationControl.isAborted) {
      throw new MobileRagAbortError(0)
    }

    await service.detectDimension()

    if (mobileRagOperationControl.isAborted) {
      throw new MobileRagAbortError(0)
    }

    const result = await runControlledDiaryBatchEmbedCore(deps, {
      onProgress,
      progressType: 'reembed',
      groupId: 'diary_batch'
    })
    return resolveControlledDiaryBatchEmbedCount(result)
  }

  const service = {
    async getStats(): Promise<{
      totalCount: number
      currentDimension: number
      diaryCountForVault: number
      activeVaultName: string
    }> {
      const vaultScope = await resolveVaultScope(deps)
      const activeVaultName = await vaultScope.resolveActiveVaultName()
      const activeVaultId = await vaultScope.resolveActiveVaultId()
      const globalModels = (await deps.settingsManager.get<any>('global_models')) || {}
      const rawClient = deps.rawSqlClient as RawSqlClient | undefined
      let totalCount = 0
      try {
        if (rawClient?.execute) {
          const result = await rawClient.execute({
            sql: `SELECT COUNT(*) as count FROM ${HYBRID_SEARCH_TABLE}`,
            args: []
          })
          const row = result.rows?.[0] as Record<string, number> | number[] | undefined
          totalCount = Number(
            (row && typeof row === 'object' && !Array.isArray(row) ? row.count : row?.[0]) ?? 0
          )
        }
      } catch (e) {
        logger.warn('[MobileRag] count embeddings failed', e as Error)
        const ragConfig = (await deps.settingsManager.get<any>('rag_config')) || {}
        totalCount = ragConfig.totalEmbeddings || 0
      }

      const diaryCountForVault = await countDiaryEmbeddingsForVault(rawClient, activeVaultId)

      let currentDimension = globalModels.globalEmbeddingDimension || 0
      try {
        const meta = await deps.hsRepo.getCurrentEmbeddingMeta()
        if (meta?.dimension) {
          currentDimension = meta.dimension
        }
      } catch (e) {
        logger.warn('[MobileRag] getCurrentEmbeddingMeta failed', e as Error)
      }

      return { totalCount, currentDimension, diaryCountForVault, activeVaultName }
    },

    async hasModelMismatch(): Promise<boolean> {
      const globalModels = (await deps.settingsManager.get<any>('global_models')) || {}
      const currentModelId = globalModels?.globalEmbeddingModelId as string | undefined
      if (!currentModelId) return false

      try {
        const meta = await deps.hsRepo.getCurrentEmbeddingMeta()
        if (!meta || meta.count === 0) return false

        const heterogeneous = await deps.hsRepo.countHeterogeneousEmbeddings(currentModelId)
        if (heterogeneous > 0) return true

        if (meta.modelId && meta.modelId !== currentModelId) return true

        const configuredDim = Number(globalModels.globalEmbeddingDimension || 0)
        if (configuredDim > 0 && meta.dimension > 0 && configuredDim !== meta.dimension) {
          return true
        }
      } catch (e) {
        logger.warn('[MobileRag] hasModelMismatch failed', e as Error)
      }

      return false
    },

    async reembedAll(onProgress?: RagProgressCallback): Promise<number> {
      if (isMobileRagBatchBusy()) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.rag.service.impl.helpers.L146',
            '嵌入任务正在进行中，请稍后再试'
          )
        )
      }
      setReembedInFlight(true)
      try {
        return await reembedAllInternal(onProgress)
      } finally {
        setReembedInFlight(false)
      }
    },

    requestOperationAbort(): void {
      mobileRagOperationControl.requestAbort()
    },

    requestOperationPause(): void {
      mobileRagOperationControl.requestPause()
    },

    requestOperationResume(): void {
      mobileRagOperationControl.requestResume()
    },

    isOperationPaused(): boolean {
      return mobileRagOperationControl.isPaused
    },

    async detectDimension(): Promise<number> {
      const adapter = await resolveEmbeddingAdapter(deps)
      if (!adapter) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.rag.service.impl.helpers.L164',
            '嵌入模型未配置'
          )
        )
      }

      const vector = await adapter.embedQuery('hi')
      if (!vector?.length) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.rag.service.impl.helpers.L169',
            '嵌入 API 未返回有效向量'
          )
        )
      }

      const dimension = vector.length
      const globalModels = (await deps.settingsManager.get<any>('global_models')) || {}
      globalModels.globalEmbeddingDimension = dimension
      await deps.settingsManager.set('global_models', globalModels)

      try {
        await deps.hsRepo.initVectorIndex(dimension)
      } catch (e) {
        logger.warn('[MobileRag] initVectorIndex failed', e as Error)
      }

      return dimension
    },

    async batchEmbed(onProgress?: RagProgressCallback): Promise<number> {
      const result = await runControlledDiaryBatchEmbed(deps, {
        onProgress,
        groupId: 'diary_batch'
      })
      return resolveControlledDiaryBatchEmbedCount(result)
    },

    async queryEntries(params: {
      keyword?: string
      limit?: number
      offset?: number
      mode?: 'semantic' | 'text'
      withTotal?: boolean
      minSimilarity?: number
      sourceType?: string
      sourceKind?: RagVectorKindFilter
    }): Promise<{ entries: Array<Record<string, unknown>>; total: number }> {
      return queryMobileRagEntries(deps, params)
    },

    async editEntry(embeddingId: string, newText: string): Promise<void> {
      await editMobileRagEntry(deps, embeddingId, newText)
    },

    async addManualMemory(text: string): Promise<void> {
      await addMobileManualMemory(deps, text)
    },

    async deleteEntry(embeddingId: string): Promise<void> {
      await deleteMobileRagEntry(deps, embeddingId)
    },

    async clearAll(): Promise<void> {
      await clearAllMobileRag(deps)
    },

    async getUnindexedDiaryCount(): Promise<number> {
      const { getPendingEmbedCounts } = await import('./mobile-pending-embed-counts')
      const counts = await getPendingEmbedCounts(deps)
      return counts.diaries
    },

    async getPendingEmbedCounts() {
      const { getPendingEmbedCounts } = await import('./mobile-pending-embed-counts')
      return getPendingEmbedCounts(deps)
    },

    async getOrganizePendingSnapshot() {
      const { getOrganizePendingSnapshot } = await import('./mobile-pending-embed-counts')
      return getOrganizePendingSnapshot(deps)
    }
  }

  return service
}
