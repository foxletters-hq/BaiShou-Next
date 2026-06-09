import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  type RagState
} from '@baishou/ui/native'
import {
  AIProviderConfig,
  DEFAULT_BATCH_EMBED_CONCURRENCY,
  GlobalModelsConfig,
  isEmbeddingModel,
  isTtsModel,
  type RagConfig as SharedRagConfig
} from '@baishou/shared'
import { useBaishou } from '../../../providers/BaishouProvider'
import { useMobileRagSystem } from '../../../hooks/useMobileRagSystem'
import { TextPromptModal } from './TextPromptModal'

const DEFAULT_RAG_CONFIG: RagConfig = {
  ragEnabled: true,
  ragTopK: 20,
  ragSimilarityThreshold: 0.4,
  batchEmbedConcurrency: DEFAULT_BATCH_EMBED_CONCURRENCY
}

type PromptMode = 'manual' | 'edit' | 'clear' | null

function buildEmbeddingProviders(providers: AIProviderConfig[]): MockAiProviderModel[] {
  return providers
    .filter((p) => p.isEnabled && (p.enabledModels?.length || p.models?.length))
    .map((p) => {
      const pool = p.enabledModels?.length ? p.enabledModels : p.models || []
      const filtered = pool.filter((modelId) => isEmbeddingModel(modelId) && !isTtsModel(modelId))
      return {
        id: p.id,
        name: p.name || p.id,
        type: p.type,
        enabledModels: filtered,
        models: filtered
      }
    })
    .filter((p) => (p.enabledModels?.length ?? 0) > 0)
}

export const RAGMemorySection: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { services, dbReady } = useBaishou()
  const toast = useNativeToast()
  const dialog = useDialog()

  const [config, setConfig] = useState<RagConfig>(DEFAULT_RAG_CONFIG)
  const [stats, setStats] = useState({
    totalCount: 0,
    currentDimension: 0,
    totalSizeText: '0 KB'
  })
  const [entries, setEntries] = useState<RagEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'semantic' | 'text'>('semantic')
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
  const editEntryRef = useRef<RagEntry | null>(null)

  const stateRef = useRef({ searchQuery, searchMode, currentPage, pageSize })
  useEffect(() => {
    stateRef.current = { searchQuery, searchMode, currentPage, pageSize }
  }, [searchQuery, searchMode, currentPage, pageSize])

  const mapEntry = (raw: Record<string, unknown>, fallbackModelId?: string): RagEntry => ({
    embeddingId: String(raw.embeddingId ?? ''),
    text: String(raw.text ?? ''),
    modelId: String(raw.modelId ?? fallbackModelId ?? ''),
    createdAt: Number(raw.createdAt ?? Date.now()),
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

      const ragStats = await services.ragService.getStats()
      const globalModels =
        (await services.settingsManager.get<{
          globalEmbeddingProviderId?: string
          globalEmbeddingModelId?: string
        }>('global_models')) || {}
      setEmbeddingProviderId(globalModels.globalEmbeddingProviderId)
      setEmbeddingModelId(globalModels.globalEmbeddingModelId)
      setStats({
        totalCount: ragStats.totalCount,
        currentDimension: ragStats.currentDimension,
        totalSizeText: `${(ragStats.totalCount * 2.5).toFixed(1)} KB`
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

      const res = await services.ragService.queryEntries(params)
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
        setEntries(res.entries.map((e) => mapEntry(e as Record<string, unknown>, fallbackModel)))
        setTotalCount(res.total)
      }

      await checkModelMismatch()
    },
    [services, dbReady, checkModelMismatch]
  )

  useEffect(() => {
    if (!dbReady || !services) return
    const init = async () => {
      const providerList =
        (await services.settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
      setProviders(providerList)
      const saved = (await services.settingsManager.get<SharedRagConfig>('rag_config')) ?? null
      setConfig({
        ragEnabled: saved?.ragEnabled ?? DEFAULT_RAG_CONFIG.ragEnabled,
        ragTopK: saved?.ragTopK ?? DEFAULT_RAG_CONFIG.ragTopK,
        ragSimilarityThreshold:
          saved?.ragSimilarityThreshold ?? DEFAULT_RAG_CONFIG.ragSimilarityThreshold,
        batchEmbedConcurrency: saved?.batchEmbedConcurrency ?? DEFAULT_BATCH_EMBED_CONCURRENCY
      })
      await loadRagData('', 'text', 1, 10)
    }
    void init()
  }, [dbReady, services, loadRagData])

  const embeddingProviders = useMemo(() => buildEmbeddingProviders(providers), [providers])

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
    await services.settingsManager.set('rag_config', next)
    setConfig(next)
  }

  const handleSearch = (query: string, mode: 'semantic' | 'text') => {
    setSearchQuery(query)
    setSearchMode(mode)
    setCurrentPage(1)
    void loadRagData(query, mode, 1, pageSize)
  }

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
      toast.showSuccess(t('settings.rag_detect_success', { dimension: String(dimension) }))
      await loadRagData()
    } catch (e: unknown) {
      toast.showError(e instanceof Error ? e.message : t('settings.rag_detect_error'))
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
      toast.showError(e instanceof Error ? e.message : t('settings.rag_batch_embed_failed'))
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
  }, [handleReembedAfterModelChange, loadRagData, pageSize])

  return (
    <>
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
        onChange={saveConfig}
        onDetectDimension={handleDetectDimension}
        onBatchEmbed={handleBatchEmbed}
        onTriggerMigration={handleTriggerMigration}
        onAddManualMemory={handleAddManualMemory}
        onClearAll={handleClearAll}
        onSearch={handleSearch}
        onDeleteEntry={handleDeleteEntry}
        onEditEntry={handleEditEntry}
        onConfigureModel={openModelSwitcher}
        onPageChange={handlePageChange}
      />

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
