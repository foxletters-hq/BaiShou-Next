import { useEffect, useRef, useState } from 'react'
import { InteractionManager, Platform } from 'react-native'
import { useBaishou } from '../../../../providers/BaishouProvider'
import { useMobileRagSystem } from '../../../../hooks/useMobileRagSystem'
import { appendDiagnosticBreadcrumb } from '../../../../services/mobile-diagnostic-log.service'
import type { RagConfig, RagEntry, RagStats } from '@baishou/ui/native'
import type { AIProviderConfig } from '@baishou/shared'
import { DEFAULT_RAG_CONFIG, type PromptMode } from './rag-memory-section.constants'
import type { RagMemorySectionCtx } from './useRagMemorySection.ctx'
import { useRagMemoryData } from './useRagMemoryData'
import { useRagMemoryActions } from './useRagMemoryActions'

export function useRagMemorySection() {
  const { services, dbReady, storageIndexing, ecosystemResyncEpoch } = useBaishou()

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

  const ctx: RagMemorySectionCtx = {
    services,
    dbReady,
    storageIndexing,
    ecosystemResyncEpoch,
    config,
    setConfig,
    stats,
    setStats,
    entries,
    setEntries,
    totalCount,
    setTotalCount,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    embeddingModelId,
    embeddingProviderId,
    setEmbeddingModelId,
    setEmbeddingProviderId,
    providers,
    setProviders,
    showModelSwitcher,
    setShowModelSwitcher,
    ragState,
    setRagState,
    checkModelMismatch,
    handleReembedAfterModelChange,
    hasMismatchModel,
    promptMode,
    setPromptMode,
    promptDefault,
    setPromptDefault,
    ragCancelBusy,
    setRagCancelBusy,
    editEntryRef,
    androidRenderStage,
    stateRef
  }

  const data = useRagMemoryData(ctx)
  const actions = useRagMemoryActions(ctx, data)

  return {
    ...ctx,
    ...data,
    ...actions
  }
}
