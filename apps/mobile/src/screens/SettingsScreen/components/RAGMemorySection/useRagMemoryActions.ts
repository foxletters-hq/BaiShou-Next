import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog, useNativeToast, type RagConfig, type RagEntry } from '@baishou/ui/native'
import { GlobalModelsConfig } from '@baishou/shared'
import { MobileRagAbortError } from '../../../../services/mobile-rag.service'
import { clampMobileRagConfig } from './rag-memory-section.constants'
import type { RagMemorySectionCtx } from './useRagMemorySection.ctx'

export function useRagMemoryActions(
  ctx: RagMemorySectionCtx,
  data: {
    loadRagData: (
      q?: string,
      mode?: 'semantic' | 'text',
      page?: number,
      size?: number
    ) => Promise<void>
    refreshEntriesOnly: (
      q?: string,
      mode?: 'semantic' | 'text',
      page?: number,
      size?: number
    ) => Promise<void>
    openModelSwitcher: () => Promise<void>
    semanticAvailable: boolean
  }
) {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useNativeToast()
  const { loadRagData, refreshEntriesOnly, openModelSwitcher, semanticAvailable } = data
  const {
    services,
    dbReady,
    config,
    setConfig,
    embeddingProviderId,
    embeddingModelId,
    setEmbeddingProviderId,
    setEmbeddingModelId,
    setShowModelSwitcher,
    checkModelMismatch,
    ragState,
    setRagState,
    setRagCancelBusy,
    searchMode,
    setSearchMode,
    searchQuery,
    pageSize,
    setSearchQuery,
    setCurrentPage,
    currentPage,
    setPageSize,
    setPromptMode,
    setPromptDefault,
    promptMode,
    editEntryRef,
    entries,
    setEntries,
    totalCount,
    setTotalCount,
    stats,
    setStats,
    handleReembedAfterModelChange
  } = ctx

  const handleSelectEmbeddingModel = useCallback(
    async (providerId: string, modelId: string) => {
      if (!services || !dbReady) return

      const isSwitching =
        embeddingProviderId &&
        embeddingModelId &&
        (embeddingProviderId !== providerId || embeddingModelId !== modelId)

      if (isSwitching) {
        const confirmed = await dialog.confirm(t('agent.rag.migration_switch_warning_content'), {
          title: t('agent.rag.migration_switch_warning_title')
        })
        if (!confirmed) return
      }

      const current =
        (await services.settingsManager.get<GlobalModelsConfig>('global_models')) ||
        ({} as GlobalModelsConfig)
      await services.settingsManager.set('global_models', {
        ...current,
        globalEmbeddingProviderId: providerId,
        globalEmbeddingModelId: modelId
      })
      setEmbeddingProviderId(providerId)
      setEmbeddingModelId(modelId)
      setShowModelSwitcher(false)
      await checkModelMismatch()
      await loadRagData()
    },
    [
      services,
      dbReady,
      embeddingProviderId,
      embeddingModelId,
      dialog,
      t,
      checkModelMismatch,
      loadRagData,
      setEmbeddingProviderId,
      setEmbeddingModelId,
      setShowModelSwitcher
    ]
  )

  const saveConfig = useCallback(
    async (next: RagConfig) => {
      if (!services || !dbReady) return
      const clamped = clampMobileRagConfig(next)
      await services.settingsManager.set('rag_config', clamped)
      setConfig(clamped)
    },
    [services, dbReady, setConfig]
  )

  const handleSemanticUnavailable = useCallback(async () => {
    if (config.ragEnabled) {
      await openModelSwitcher()
      return
    }
    const goConfigure = await dialog.confirm(t('settings.rag_semantic_unavailable_message'), {
      title: t('settings.rag_semantic_unavailable_title'),
      confirmText: t('settings.rag_go_configure')
    })
    if (!goConfigure) return
    const next = { ...config, ragEnabled: true }
    await saveConfig(next)
    await openModelSwitcher()
  }, [config, dialog, openModelSwitcher, t, saveConfig])

  useEffect(() => {
    if (!ragState.isRunning) {
      setRagCancelBusy(false)
    }
  }, [ragState.isRunning, setRagCancelBusy])

  const handleSearch = (query: string, mode: 'semantic' | 'text') => {
    setSearchQuery(query)
    setSearchMode(mode)
    setCurrentPage(1)
    void loadRagData(query, mode, 1, pageSize)
  }

  useEffect(() => {
    if (!semanticAvailable && searchMode === 'semantic') {
      setSearchMode('text')
    }
  }, [semanticAvailable, searchMode, setSearchMode])

  const handlePageChange = (page: number, size: number) => {
    setCurrentPage(page)
    setPageSize(size)
    void refreshEntriesOnly(searchQuery, searchMode, page, size)
  }

  const handleDetectDimension = async () => {
    if (!services?.ragService) return
    setRagState({
      isRunning: true,
      type: 'detect',
      progress: 0,
      total: 1,
      statusText: t('settings.rag_detect_dimension')
    })
    try {
      const globalModels =
        (await services.settingsManager.get<{
          globalEmbeddingProviderId?: string
          globalEmbeddingModelId?: string
        }>('global_models')) || {}
      if (!globalModels.globalEmbeddingProviderId || !globalModels.globalEmbeddingModelId) {
        toast.showWarning(t('ai_config.error_no_model'))
        return
      }
      const dimension = await services.ragService.detectDimension()
      toast.showSuccess(
        t('settings.rag.detect_success', '检测成功：${dimension}维').replace(
          '${dimension}',
          String(dimension)
        )
      )
      await loadRagData()
    } catch (e: unknown) {
      toast.showError(
        e instanceof Error ? e.message : t('settings.rag.detect_failed', '检测失败，请检查模型配置')
      )
    } finally {
      setRagState({
        isRunning: false,
        type: 'idle',
        progress: 0,
        total: 0,
        statusText: ''
      })
    }
  }

  const handleBatchEmbed = async () => {
    if (!services?.ragService) return
    setRagState({
      isRunning: true,
      type: 'batchEmbed',
      progress: 0,
      total: 0,
      statusText: t('settings.rag_batch_embed')
    })
    try {
      const count = await services.ragService.batchEmbed((p) => {
        setRagState({
          isRunning: true,
          type: 'batchEmbed',
          progress: p.current,
          total: p.total,
          statusText: p.status || t('common.processing')
        })
      })
      toast.showSuccess(t('settings.rag_batch_embed_done', { count: String(count) }))
      await loadRagData()
    } catch (e: unknown) {
      if (e instanceof MobileRagAbortError) {
        toast.showWarning(
          t('settings.rag_batch_embed_aborted', {
            count: String(e.embeddedCount),
            defaultValue: `已取消，已完成 ${e.embeddedCount} 篇嵌入`
          })
        )
        await loadRagData()
        return
      }
      toast.showError(e instanceof Error ? e.message : t('settings.rag_batch_embed_failed'))
    } finally {
      setRagCancelBusy(false)
      setRagState({
        isRunning: false,
        type: 'idle',
        progress: 0,
        total: 0,
        statusText: ''
      })
    }
  }

  const handleCancelRagOperation = useCallback(async () => {
    if (!services?.ragService) return
    const confirmed = await dialog.confirm(
      t(
        'settings.rag_migration_cancel_confirm',
        '确定要取消当前嵌入任务吗？进行中的请求会在完成后停止，不会继续处理下一篇。'
      ),
      {
        title: t('common.warning', '警告'),
        confirmText: t('settings.rag_migration_cancel', '取消'),
        cancelText: t('common.back', '返回')
      }
    )
    if (!confirmed) return

    setRagCancelBusy(true)
    setRagState((prev) => ({
      ...prev,
      isRunning: true,
      statusKey: 'settings.rag_migration_aborting',
      statusText: t('settings.rag_migration_aborting', '正在取消并停止嵌入…')
    }))
    services.ragService.requestOperationAbort()
  }, [dialog, services?.ragService, t, setRagCancelBusy, setRagState])

  const handleClearAll = async () => {
    setPromptMode('clear')
    setPromptDefault('')
  }

  const confirmClearAll = async (phrase: string) => {
    if (!services?.ragService) return
    const expected = t('settings.rag_clear_all_confirm_phrase')
    if (phrase.trim() !== expected) {
      toast.showError(t('settings.rag_clear_all_mismatch'))
      return
    }
    try {
      await services.ragService.clearAll()
      setCurrentPage(1)
      await loadRagData('', 'text', 1, pageSize)
      toast.showSuccess(t('settings.rag_clear_all'))
    } catch (e: unknown) {
      toast.showError(e instanceof Error ? e.message : t('settings.rag_operation_failed'))
    }
  }

  const handleAddManualMemory = async () => {
    setPromptMode('manual')
    setPromptDefault('')
  }

  const handleEditEntry = async (entry: RagEntry) => {
    editEntryRef.current = entry
    setPromptMode('edit')
    setPromptDefault(entry.text)
  }

  const handleDeleteEntry = async (id: string) => {
    if (!services?.ragService) return
    const confirmed = await dialog.confirm(t('agent.assistant.delete_confirm_content'), {
      title: t('common.delete'),
      confirmText: t('common.delete'),
      destructive: true
    })
    if (!confirmed) return

    const snapshotEntries = entries
    const snapshotTotal = totalCount
    const snapshotStatsTotal = stats.totalCount
    const remainingOnPage = entries.filter((entry) => entry.embeddingId !== id)

    setEntries(remainingOnPage)
    setTotalCount((prev) => Math.max(0, prev - 1))
    setStats((prev) => ({
      ...prev,
      totalCount: Math.max(0, prev.totalCount - 1)
    }))

    try {
      await services.ragService.deleteEntry(id)
      toast.showSuccess(t('common.delete_success'))

      if (remainingOnPage.length === 0 && currentPage > 1) {
        const prevPage = currentPage - 1
        setCurrentPage(prevPage)
        void refreshEntriesOnly(searchQuery, searchMode, prevPage, pageSize)
      }
    } catch (e: unknown) {
      setEntries(snapshotEntries)
      setTotalCount(snapshotTotal)
      setStats((prev) => ({ ...prev, totalCount: snapshotStatsTotal }))
      toast.showError(e instanceof Error ? e.message : t('settings.rag_operation_failed'))
    }
  }

  const onPromptConfirm = async (value: string) => {
    const mode = promptMode
    setPromptMode(null)
    if (!services?.ragService) return

    if (mode === 'manual') {
      const text = value.trim()
      if (!text) return
      try {
        await services.ragService.addManualMemory(text)
        toast.showSuccess(t('settings.rag_add_manual_success'))
        await loadRagData()
      } catch (e: unknown) {
        toast.showError(e instanceof Error ? e.message : t('settings.rag_add_manual_failed'))
      }
      return
    }

    if (mode === 'edit' && editEntryRef.current) {
      const text = value.trim()
      if (!text) return
      try {
        await services.ragService.editEntry(editEntryRef.current.embeddingId, text)
        toast.showSuccess(t('common.save_success'))
        await loadRagData()
      } catch (e: unknown) {
        toast.showError(e instanceof Error ? e.message : t('settings.rag_operation_failed'))
      }
      editEntryRef.current = null
      return
    }

    if (mode === 'clear') {
      await confirmClearAll(value)
    }
  }

  const handleTriggerMigration = useCallback(async () => {
    const ok = await handleReembedAfterModelChange()
    if (ok) {
      setCurrentPage(1)
      await loadRagData('', 'text', 1, pageSize)
    }
    setRagCancelBusy(false)
  }, [handleReembedAfterModelChange, loadRagData, pageSize, setCurrentPage, setRagCancelBusy])

  return {
    handleSelectEmbeddingModel,
    saveConfig,
    handleSemanticUnavailable,
    handleSearch,
    handlePageChange,
    handleDetectDimension,
    handleBatchEmbed,
    handleCancelRagOperation,
    handleClearAll,
    handleAddManualMemory,
    handleEditEntry,
    handleDeleteEntry,
    onPromptConfirm,
    handleTriggerMigration
  }
}
