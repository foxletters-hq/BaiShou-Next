import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, InteractionManager, Platform, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  RagMemoryView,
  ModelSwitcher,
  useNativeToast,
  useDialog,
  type MockAiProviderModel,
  type RagConfig,
  type RagEntry,
  type RagStats
} from '@baishou/ui/native'
import {
  AIProviderConfig,
  GlobalModelsConfig,
  MOBILE_DEFAULT_BATCH_EMBED_CONCURRENCY,
  resolveMobileBatchEmbedConcurrency,
  filterProvidersForModelSwitcher,
  type RagConfig as SharedRagConfig
} from '@baishou/shared'
import { useBaishou } from '../../../providers/BaishouProvider'
import { useMobileRagSystem } from '../../../hooks/useMobileRagSystem'
import { MobileRagAbortError } from '../../../services/mobile-rag.service'
import { appendDiagnosticBreadcrumb } from '../../../services/mobile-diagnostic-log.service'
import { TextPromptModal } from './TextPromptModal'

const DEFAULT_RAG_CONFIG: RagConfig = {
  ragEnabled: true,
  ragTopK: 20,
  ragSimilarityThreshold: 0.4,
  batchEmbedConcurrency: MOBILE_DEFAULT_BATCH_EMBED_CONCURRENCY
}

/** 持久化/迁移可能把数值存成字符串，统一兜底，避免下游 toFixed 等数值方法崩溃 */
function coerceNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clampMobileRagConfig(config: RagConfig): RagConfig {
  return {
    ...config,
    ragTopK: coerceNumber(config.ragTopK, DEFAULT_RAG_CONFIG.ragTopK),
    ragSimilarityThreshold: coerceNumber(
      config.ragSimilarityThreshold,
      DEFAULT_RAG_CONFIG.ragSimilarityThreshold
    ),
    batchEmbedConcurrency: resolveMobileBatchEmbedConcurrency(config.batchEmbedConcurrency)
  }
}

type PromptMode = 'manual' | 'edit' | 'clear' | null

function buildEmbeddingProviders(providers: AIProviderConfig[]): MockAiProviderModel[] {
  return filterProvidersForModelSwitcher(providers, 'embedding')
}

export const RAGMemorySection: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { services, dbReady, storageIndexing, ecosystemResyncEpoch } = useBaishou()
  const toast = useNativeToast()
  const dialog = useDialog()

  const [config, setConfig] = useState<RagConfig>(DEFAULT_RAG_CONFIG)
  const [stats, setStats] = useState<RagStats>({
    totalCount: 0,
    currentDimension: 0,
    totalSizeText: '0 KB'
  })
  const [entries, setEntries] = useState<RagEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'semantic' | 'text'>('text')
  const [embeddingModelId, setEmbeddingModelId] = useState<string>()
  const [embeddingProviderId, setEmbeddingProviderId] = useState<string>()
  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [showModelSwitcher, setShowModelSwitcher] = useState(false)
  const {
    hasMismatchModel,
    ragState,
    setRagState,
    checkModelMismatch,
    handleReembedAfterModelChange
  } = useMobileRagSystem(services?.ragService)

  const [promptMode, setPromptMode] = useState<PromptMode>(null)
  const [promptDefault, setPromptDefault] = useState('')
  const [ragCancelBusy, setRagCancelBusy] = useState(false)
  const editEntryRef = useRef<RagEntry | null>(null)
  const [androidRenderStage, setAndroidRenderStage] = useState(Platform.OS === 'android' ? 0 : 2)

  useEffect(() => {
    appendDiagnosticBreadcrumb('RAGMemorySection mount')
    if (Platform.OS !== 'android') {
      return () => {
        appendDiagnosticBreadcrumb('RAGMemorySection unmount')
      }
    }

    appendDiagnosticBreadcrumb('RAG android render stage 0 (shell)')
    let interactionTask: { cancel: () => void } | undefined
    const frame = requestAnimationFrame(() => {
      appendDiagnosticBreadcrumb('RAG android render stage 1 (view)')
      setAndroidRenderStage(1)
      interactionTask = InteractionManager.runAfterInteractions(() => {
        appendDiagnosticBreadcrumb('RAG android render stage 2 (full)')
        setAndroidRenderStage(2)
      })
    })

    return () => {
      cancelAnimationFrame(frame)
      interactionTask?.cancel()
      appendDiagnosticBreadcrumb('RAGMemorySection unmount')
    }
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'android') return
    appendDiagnosticBreadcrumb(`RAG android render stage active: ${androidRenderStage}`)
  }, [androidRenderStage])

  const stateRef = useRef({ searchQuery, searchMode, currentPage, pageSize })
  useEffect(() => {
    stateRef.current = { searchQuery, searchMode, currentPage, pageSize }
  }, [searchQuery, searchMode, currentPage, pageSize])

  const mapEntry = (raw: Record<string, unknown>, fallbackModelId?: string): RagEntry => ({
    embeddingId: String(raw.embeddingId ?? ''),
    text: String(raw.text ?? ''),
    modelId: String(raw.modelId ?? fallbackModelId ?? ''),
    createdAt: Number(raw.createdAt ?? Date.now()),
    sourceType: raw.sourceType != null ? String(raw.sourceType) : undefined,
    similarity: typeof raw.similarity === 'number' ? raw.similarity : undefined
  })

  const loadRagData = useCallback(
    async (
      q: string = stateRef.current.searchQuery,
      mode: 'semantic' | 'text' = stateRef.current.searchMode,
      page: number = stateRef.current.currentPage,
      size: number = stateRef.current.pageSize
    ) => {
      if (!services?.ragService || !dbReady) return
      if (storageIndexing) {
        appendDiagnosticBreadcrumb('RAG loadRagData skipped: storage indexing')
        return
      }

      appendDiagnosticBreadcrumb(`RAG loadRagData start mode=${mode} page=${page}`)

      try {
        appendDiagnosticBreadcrumb('RAG getStats start')
        const ragStats = await services.ragService.getStats()
        appendDiagnosticBreadcrumb('RAG getStats done')
        appendDiagnosticBreadcrumb('RAG global models load start')
        const globalModels =
          (await services.settingsManager.get<{
            globalEmbeddingProviderId?: string
            globalEmbeddingModelId?: string
          }>('global_models')) || {}
        appendDiagnosticBreadcrumb('RAG global models load done')
        setEmbeddingProviderId(globalModels.globalEmbeddingProviderId)
        setEmbeddingModelId(globalModels.globalEmbeddingModelId)
        setStats({
          totalCount: ragStats.totalCount,
          currentDimension: ragStats.currentDimension,
          totalSizeText: `${(ragStats.totalCount * 2.5).toFixed(1)} KB`,
          diaryCountForVault: ragStats.diaryCountForVault,
          activeVaultName: ragStats.activeVaultName
        })

        const limit = size
        const offset = (page - 1) * size
        const params: {
          keyword?: string
          limit: number
          offset: number
          mode: 'semantic' | 'text'
          withTotal: boolean
        } = {
          limit,
          offset,
          mode,
          withTotal: true
        }

        if (q.trim()) {
          params.keyword = q.trim()
          if (mode === 'semantic') {
            params.limit = 50
            params.offset = 0
          }
        }

        appendDiagnosticBreadcrumb(
          `RAG queryEntries start mode=${params.mode} limit=${params.limit}`
        )
        const res = await services.ragService.queryEntries(params)
        appendDiagnosticBreadcrumb(`RAG queryEntries done total=${res.total}`)
        const fallbackModel = globalModels.globalEmbeddingModelId

        if (q.trim() && mode === 'semantic') {
          const sliced = res.entries.slice((page - 1) * size, page * size)
          setEntries(sliced.map((e) => mapEntry(e as Record<string, unknown>, fallbackModel)))
          setTotalCount(res.total)
        } else {
          if (res.total > 0 && offset >= res.total) {
            const maxPage = Math.max(1, Math.ceil(res.total / size))
            setCurrentPage(maxPage)
            await loadRagData(q, mode, maxPage, size)
            return
          }
          setEntries(
            res.entries.map((e) => {
              const entry = mapEntry(e as Record<string, unknown>, fallbackModel)
              if (mode === 'text') {
                return { ...entry, similarity: undefined }
              }
              return entry
            })
          )
          setTotalCount(res.total)
        }
      } catch (e: unknown) {
        appendDiagnosticBreadcrumb(
          `RAG loadRagData failed: ${e instanceof Error ? e.message : String(e)}`
        )
        toast.showError(e instanceof Error ? e.message : t('settings.rag_operation_failed'))
      }

      try {
        appendDiagnosticBreadcrumb('RAG checkModelMismatch start')
        await checkModelMismatch()
        appendDiagnosticBreadcrumb('RAG checkModelMismatch done')
      } catch (e: unknown) {
        appendDiagnosticBreadcrumb(
          `RAG checkModelMismatch failed: ${e instanceof Error ? e.message : String(e)}`
        )
        console.warn('[RAGMemorySection] checkModelMismatch failed', e)
      }
    },
    [services, dbReady, storageIndexing, checkModelMismatch, toast, t]
  )

  useEffect(() => {
    if (!dbReady || !services) return
    if (storageIndexing) {
      appendDiagnosticBreadcrumb('RAG init deferred: storage indexing')
      return
    }
    let cancelled = false

    const runInit = async () => {
      try {
        const providerList =
          (await services.settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
        if (cancelled) return
        setProviders(providerList)
        const saved = (await services.settingsManager.get<SharedRagConfig>('rag_config')) ?? null
        const loaded = clampMobileRagConfig({
          ragEnabled: saved?.ragEnabled ?? DEFAULT_RAG_CONFIG.ragEnabled,
          ragTopK: saved?.ragTopK ?? DEFAULT_RAG_CONFIG.ragTopK,
          ragSimilarityThreshold:
            saved?.ragSimilarityThreshold ?? DEFAULT_RAG_CONFIG.ragSimilarityThreshold,
          batchEmbedConcurrency:
            saved?.batchEmbedConcurrency ?? MOBILE_DEFAULT_BATCH_EMBED_CONCURRENCY
        })
        if (cancelled) return
        setConfig(loaded)
        if (
          saved?.batchEmbedConcurrency != null &&
          loaded.batchEmbedConcurrency !== saved.batchEmbedConcurrency
        ) {
          await services.settingsManager.set('rag_config', loaded)
        }
        if (cancelled) return
        appendDiagnosticBreadcrumb('RAG init config loaded')
        await loadRagData('', 'text', 1, 10)
        appendDiagnosticBreadcrumb('RAG init loadRagData finished')
      } catch (e: unknown) {
        if (!cancelled) {
          toast.showError(e instanceof Error ? e.message : t('settings.rag_operation_failed'))
        }
      }
    }

    if (Platform.OS === 'android') {
      const task = InteractionManager.runAfterInteractions(() => {
        void runInit()
      })
      return () => {
        cancelled = true
        task.cancel()
      }
    }

    void runInit()
    return () => {
      cancelled = true
    }
  }, [dbReady, services, storageIndexing, ecosystemResyncEpoch, loadRagData, toast, t])

  const embeddingProviders = useMemo(() => buildEmbeddingProviders(providers), [providers])

  const semanticAvailable = config.ragEnabled && Boolean(embeddingProviderId && embeddingModelId)

  const openModelSwitcher = useCallback(async () => {
    if (embeddingProviders.length === 0) {
      const goConfigure = await dialog.confirm(t('settings.no_models_available'), {
        title: t('ai_config.embedding_model_title'),
        confirmText: t('settings.manage_providers')
      })
      if (goConfigure) {
        router.push('/settings/ai-services')
      }
      return
    }
    setShowModelSwitcher(true)
  }, [embeddingProviders.length, dialog, router, t])

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
      loadRagData
    ]
  )

  const saveConfig = async (next: RagConfig) => {
    if (!services || !dbReady) return
    const clamped = clampMobileRagConfig(next)
    await services.settingsManager.set('rag_config', clamped)
    setConfig(clamped)
  }

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
  }, [config, dialog, openModelSwitcher, t, services, dbReady])

  useEffect(() => {
    if (!ragState.isRunning) {
      setRagCancelBusy(false)
    }
  }, [ragState.isRunning])

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
  }, [semanticAvailable, searchMode])

  const handlePageChange = (page: number, size: number) => {
    setCurrentPage(page)
    setPageSize(size)
    void loadRagData(searchQuery, searchMode, page, size)
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
  }, [dialog, services?.ragService, t])

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
    await services.ragService.deleteEntry(id)
    await loadRagData()
    toast.showSuccess(t('common.delete_success'))
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
  }, [handleReembedAfterModelChange, loadRagData, pageSize])

  return (
    <>
      {Platform.OS === 'android' && (androidRenderStage < 1 || storageIndexing) ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator size="small" />
        </View>
      ) : (
        <RagMemoryView
          config={config}
          stats={stats}
          ragState={ragState}
          hasMismatchModel={hasMismatchModel}
          embeddingModelId={embeddingModelId}
          entries={entries}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          searchQuery={searchQuery}
          searchMode={searchMode}
          semanticAvailable={semanticAvailable}
          onSemanticUnavailable={() => void handleSemanticUnavailable()}
          onChange={saveConfig}
          onDetectDimension={handleDetectDimension}
          onBatchEmbed={handleBatchEmbed}
          onTriggerMigration={handleTriggerMigration}
          onCancelMigration={handleCancelRagOperation}
          migrationCancelBusy={ragCancelBusy}
          onAddManualMemory={handleAddManualMemory}
          onClearAll={handleClearAll}
          onSearch={androidRenderStage >= 2 ? handleSearch : undefined}
          onDeleteEntry={handleDeleteEntry}
          onEditEntry={handleEditEntry}
          onConfigureModel={openModelSwitcher}
          onPageChange={handlePageChange}
        />
      )}

      <ModelSwitcher
        isOpen={showModelSwitcher}
        onClose={() => setShowModelSwitcher(false)}
        providers={embeddingProviders}
        currentProviderId={embeddingProviderId}
        currentModelId={embeddingModelId}
        onSelect={handleSelectEmbeddingModel}
        onManageProviders={() => router.push('/settings/ai-services')}
      />

      <TextPromptModal
        visible={promptMode === 'manual'}
        title={t('settings.rag_add_manual')}
        placeholder={t('settings.rag_edit_manual')}
        multiline
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setPromptMode(null)}
        onConfirm={onPromptConfirm}
      />

      <TextPromptModal
        visible={promptMode === 'edit'}
        title={t('settings.rag_edit_manual')}
        defaultValue={promptDefault}
        multiline
        confirmLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        onCancel={() => {
          setPromptMode(null)
          editEntryRef.current = null
        }}
        onConfirm={onPromptConfirm}
      />

      <TextPromptModal
        visible={promptMode === 'clear'}
        title={t('settings.rag_clear_all')}
        message={t('settings.rag_clear_all_confirm')}
        placeholder={t('settings.rag_clear_all_confirm_phrase')}
        defaultValue={promptDefault}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setPromptMode(null)}
        onConfirm={onPromptConfirm}
      />
    </>
  )
}
