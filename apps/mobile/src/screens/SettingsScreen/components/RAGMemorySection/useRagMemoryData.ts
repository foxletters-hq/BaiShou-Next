import { useCallback, useEffect, useMemo, useRef } from 'react'
import { InteractionManager, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useDialog, useNativeToast, type RagEntry } from '@baishou/ui/native'
import type { AIProviderConfig, RagConfig as SharedRagConfig } from '@baishou/shared'
import { MOBILE_DEFAULT_BATCH_EMBED_CONCURRENCY } from '@baishou/shared'
import { appendDiagnosticBreadcrumb } from '../../../../services/mobile-diagnostic-log.service'
import {
  DEFAULT_RAG_CONFIG,
  buildEmbeddingProviders,
  clampMobileRagConfig
} from './rag-memory-section.constants'
import type { RagMemorySectionCtx } from './useRagMemorySection.ctx'

export function useRagMemoryData(ctx: RagMemorySectionCtx) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const router = useRouter()
  const {
    services,
    dbReady,
    storageIndexing,
    ecosystemResyncEpoch,
    setConfig,
    setStats,
    setEntries,
    setTotalCount,
    setCurrentPage,
    setEmbeddingProviderId,
    setEmbeddingModelId,
    setProviders,
    setShowModelSwitcher,
    setIsSearching,
    stateRef,
    checkModelMismatch,
    config,
    providers,
    embeddingProviderId,
    embeddingModelId
  } = ctx

  const mapEntry = (raw: Record<string, unknown>, fallbackModelId?: string): RagEntry => ({
    embeddingId: String(raw.embeddingId ?? ''),
    text: String(raw.text ?? ''),
    modelId: String(raw.modelId ?? fallbackModelId ?? ''),
    createdAt: Number(raw.createdAt ?? Date.now()),
    sourceType: raw.sourceType != null ? String(raw.sourceType) : undefined,
    similarity: typeof raw.similarity === 'number' ? raw.similarity : undefined,
    sourceId: raw.sourceId != null ? String(raw.sourceId) : undefined,
    isManual: raw.isManual === true,
    sourceSessionId:
      raw.sourceSessionId === null
        ? null
        : raw.sourceSessionId != null
          ? String(raw.sourceSessionId)
          : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag)) : undefined
  })

  const queryGenerationRef = useRef(0)
  const isQueryStale = (generation: number) => generation !== queryGenerationRef.current

  const refreshEntriesOnly = useCallback(
    async (
      q: string = stateRef.current.searchQuery,
      mode: 'semantic' | 'text' = stateRef.current.searchMode,
      page: number = stateRef.current.currentPage,
      size: number = stateRef.current.pageSize
    ) => {
      if (!services?.ragService || !dbReady) {
        setIsSearching(false)
        return
      }
      if (storageIndexing) {
        setIsSearching(false)
        return
      }

      const generation = ++queryGenerationRef.current
      setIsSearching(true)
      try {
        const globalModels =
          (await services.settingsManager.get<{
            globalEmbeddingProviderId?: string
            globalEmbeddingModelId?: string
          }>('global_models')) || {}
        const fallbackModel = globalModels.globalEmbeddingModelId

        const limit = size
        const offset = (page - 1) * size
        const params: {
          keyword?: string
          limit: number
          offset: number
          mode: 'semantic' | 'text'
          withTotal: boolean
          sourceKind: typeof stateRef.current.sourceKind
        } = {
          limit,
          offset,
          mode,
          withTotal: true,
          sourceKind: stateRef.current.sourceKind
        }

        if (q.trim()) {
          params.keyword = q.trim()
          if (mode === 'semantic') {
            params.limit = 50
            params.offset = 0
          }
        }

        const res = await services.ragService.queryEntries(params)
        if (isQueryStale(generation)) return

        if (q.trim() && mode === 'semantic') {
          const sliced = res.entries.slice((page - 1) * size, page * size)
          setEntries(sliced.map((e) => mapEntry(e as Record<string, unknown>, fallbackModel)))
          setTotalCount(res.total)
          return
        }

        if (res.total > 0 && offset >= res.total) {
          const maxPage = Math.max(1, Math.ceil(res.total / size))
          setCurrentPage(maxPage)
          await refreshEntriesOnly(q, mode, maxPage, size)
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
      } catch (e: unknown) {
        if (isQueryStale(generation)) return
        toast.showError(e instanceof Error ? e.message : t('settings.rag_operation_failed'))
      } finally {
        if (!isQueryStale(generation)) {
          setIsSearching(false)
        }
      }
    },
    [
      services,
      dbReady,
      storageIndexing,
      stateRef,
      setEntries,
      setTotalCount,
      setCurrentPage,
      setIsSearching,
      t,
      toast
    ]
  )

  const loadRagData = useCallback(
    async (
      q: string = stateRef.current.searchQuery,
      mode: 'semantic' | 'text' = stateRef.current.searchMode,
      page: number = stateRef.current.currentPage,
      size: number = stateRef.current.pageSize
    ) => {
      if (!services?.ragService || !dbReady) {
        setIsSearching(false)
        return
      }
      if (storageIndexing) {
        appendDiagnosticBreadcrumb('RAG loadRagData skipped: storage indexing')
        setIsSearching(false)
        return
      }

      const generation = ++queryGenerationRef.current
      setIsSearching(true)
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
          sourceKind: typeof stateRef.current.sourceKind
        } = {
          limit,
          offset,
          mode,
          withTotal: true,
          sourceKind: stateRef.current.sourceKind
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
        if (isQueryStale(generation)) return
        const fallbackModel = globalModels.globalEmbeddingModelId

        if (q.trim() && mode === 'semantic') {
          const sliced = res.entries.slice((page - 1) * size, page * size)
          setEntries(sliced.map((e) => mapEntry(e as Record<string, unknown>, fallbackModel)))
          setTotalCount(res.total)
        } else {
          if (res.total > 0 && offset >= res.total) {
            const maxPage = Math.max(1, Math.ceil(res.total / size))
            setCurrentPage(maxPage)
            await refreshEntriesOnly(q, mode, maxPage, size)
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
        if (!isQueryStale(generation)) {
          toast.showError(e instanceof Error ? e.message : t('settings.rag_operation_failed'))
        }
      } finally {
        if (!isQueryStale(generation)) {
          setIsSearching(false)
        }
      }

      if (isQueryStale(generation)) return

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
    [
      services,
      dbReady,
      storageIndexing,
      stateRef,
      setEmbeddingProviderId,
      setEmbeddingModelId,
      setStats,
      setEntries,
      setTotalCount,
      setCurrentPage,
      checkModelMismatch,
      refreshEntriesOnly,
      setIsSearching,
      t,
      toast
    ]
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
  }, [
    dbReady,
    services,
    storageIndexing,
    ecosystemResyncEpoch,
    loadRagData,
    setConfig,
    setProviders,
    t,
    toast
  ])

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
  }, [embeddingProviders.length, dialog, router, t, setShowModelSwitcher])

  const invalidateInFlightQuery = useCallback(() => {
    queryGenerationRef.current += 1
    setIsSearching(true)
  }, [setIsSearching])

  return {
    loadRagData,
    refreshEntriesOnly,
    invalidateInFlightQuery,
    openModelSwitcher,
    semanticAvailable,
    embeddingProviders
  }
}
