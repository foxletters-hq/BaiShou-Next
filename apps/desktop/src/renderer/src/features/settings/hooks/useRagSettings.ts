import { useState, useEffect, useRef, useSyncExternalStore, useCallback } from 'react'
import { localizeAiApiErrorMessage, type RagVectorKindFilter } from '@baishou/shared'
import { useRagSystem } from './useRagSystem'
import { useRagActions } from './useRagActions'
import {
  getCachedRagActiveState,
  getCachedRagStats,
  setCachedRagStats,
  subscribeRagRuntime
} from '../rag-runtime-cache'

interface UseRagSettingsProps {
  settings: any
  t: any
  toast: any
  confirm: (message: string, title?: string) => Promise<boolean>
  prompt: (
    message: string,
    defaultValue?: string,
    title?: string,
    required?: boolean
  ) => Promise<string | null>
  alert: (message: string, title?: string) => Promise<void>
}

function useRagStatsFromCache() {
  return useSyncExternalStore(
    subscribeRagRuntime,
    () => getCachedRagStats(),
    () => getCachedRagStats()
  )
}

export function useRagSettings({
  settings,
  t,
  toast,
  confirm,
  prompt,
  alert
}: UseRagSettingsProps) {
  const ragStats = useRagStatsFromCache()
  const [ragEntries, setRagEntries] = useState<any[]>([])
  const [ragTotalCount, setRagTotalCount] = useState(() => getCachedRagStats().totalCount)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'semantic' | 'text'>('semantic')
  const [sourceKind, setSourceKind] = useState<RagVectorKindFilter>('all')
  const [isSearching, setIsSearching] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const stateRef = useRef({ searchQuery, searchMode, sourceKind, currentPage, pageSize })
  const dataGenerationRef = useRef(0)
  const checkMigrationStatusRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    stateRef.current = { searchQuery, searchMode, sourceKind, currentPage, pageSize }
  }, [searchQuery, searchMode, sourceKind, currentPage, pageSize])

  const isDataRequestStale = (generation: number) => generation !== dataGenerationRef.current

  const loadRagData = useCallback(
    async (
      q: string,
      mode: 'semantic' | 'text',
      page: number,
      size: number,
      generation = dataGenerationRef.current,
      kind: RagVectorKindFilter = stateRef.current.sourceKind,
      options?: { includeStats?: boolean; checkMigration?: boolean }
    ) => {
      const includeStats = options?.includeStats ?? true
      const checkMigration = options?.checkMigration ?? includeStats
      setIsSearching(true)
      try {
        const limit = size
        const offset = (page - 1) * limit
        const params: any = { limit, offset, mode, withTotal: true, sourceKind: kind }

        if (q && q.trim() !== '') {
          params.keyword = q
          if (mode === 'semantic') {
            params.limit = 50
            params.offset = 0
          }
        }

        const [statsResult, entriesResult] = await Promise.all([
          includeStats ? (window as any).api?.rag?.getStats() : Promise.resolve(null),
          (window as any).api?.rag?.queryEntries(params)
        ])

        if (isDataRequestStale(generation)) return

        if (statsResult) {
          setCachedRagStats(statsResult)
        }

        const s = statsResult ?? getCachedRagStats()
        const res = entriesResult

        if (res) {
          if (res.entries && typeof res.total === 'number') {
            const total = res.total
            if (total > 0 && (page - 1) * size >= total) {
              const maxPage = Math.max(1, Math.ceil(total / size))
              setCurrentPage(maxPage)
              await loadRagData(q, mode, maxPage, size, generation, kind, {
                includeStats: false,
                checkMigration: false
              })
              return
            }
            if (q && q.trim() !== '' && mode === 'semantic') {
              const allEntries = res.entries
              const semanticTotal = res.total
              const sliced = allEntries.slice((page - 1) * size, page * size)
              if (isDataRequestStale(generation)) return
              setRagEntries(sliced)
              setRagTotalCount(semanticTotal)
            } else {
              if (isDataRequestStale(generation)) return
              setRagEntries(res.entries)
              setRagTotalCount(res.total)
            }
          } else {
            if (isDataRequestStale(generation)) return
            setRagEntries(res)
            setRagTotalCount(s ? s.totalCount || 0 : 0)
          }
        } else if (s) {
          if (isDataRequestStale(generation)) return
          setRagTotalCount(s.totalCount || 0)
        }

        if (isDataRequestStale(generation)) return
        setIsSearching(false)
        if (checkMigration) await checkMigrationStatusRef.current()
      } catch (err) {
        console.error('[SettingsPage] loadRagData failed:', err)
        if (!isDataRequestStale(generation)) {
          setRagEntries([])
          toast.showError(localizeAiApiErrorMessage(err, t))
        }
      } finally {
        if (!isDataRequestStale(generation)) {
          setIsSearching(false)
        }
      }
    },
    []
  )

  const fetchRagInfo = async (page?: number, size?: number) => {
    const targetPage = page !== undefined ? page : stateRef.current.currentPage
    const targetSize = size !== undefined ? size : stateRef.current.pageSize
    await loadRagData(
      stateRef.current.searchQuery,
      stateRef.current.searchMode,
      targetPage,
      targetSize
    )
  }

  const {
    isProcessing,
    setIsProcessing,
    activeRagState,
    hasMismatchModel,
    migrationState,
    checkMigrationStatus,
    handleDetectDimension,
    handleClearDimension,
    handleBatchEmbed,
    handlePauseBatchEmbed,
    handleResumeBatchEmbed,
    handleCancelBatchEmbed,
    handleTriggerMigration,
    handleCancelMigration,
    handleRestoreMigration,
    handleResumeMigration,
    handleClearAll
  } = useRagSystem(t, toast, confirm, alert, fetchRagInfo, async () => {
    if (typeof settings.reloadConfigKeys === 'function') {
      await settings.reloadConfigKeys(['ragConfig'])
      return
    }
    await settings.loadConfig?.({ force: true })
  })

  checkMigrationStatusRef.current = checkMigrationStatus

  const {
    handleAddManualMemory,
    handleDeleteEntry,
    handleEditEntry,
    handleExportEmbeddings,
    handleManageBackups
  } = useRagActions(t, toast, confirm, prompt, alert, fetchRagInfo, setIsProcessing)

  useEffect(() => {
    const generation = ++dataGenerationRef.current
    // 筛选/翻页只重拉当前页列表。统计与迁移检查由 prefetch / useRagSystem / 写后 reload 负责。
    void loadRagData(searchQuery, searchMode, currentPage, pageSize, generation, sourceKind, {
      includeStats: false,
      checkMigration: false
    })
    return () => {
      dataGenerationRef.current += 1
    }
  }, [loadRagData, searchQuery, searchMode, sourceKind, currentPage, pageSize])

  const reloadRagList = useCallback(() => {
    const generation = ++dataGenerationRef.current
    void loadRagData(
      stateRef.current.searchQuery,
      stateRef.current.searchMode,
      stateRef.current.currentPage,
      stateRef.current.pageSize,
      generation,
      stateRef.current.sourceKind
    )
  }, [loadRagData])

  useEffect(() => {
    const api = (window as any).api
    if (!api?.diary?.onSyncEvent) return

    const unsubscribe = api.diary.onSyncEvent((event: { type?: string }) => {
      if (event?.type === 'embed-pending-changed') {
        if (getCachedRagActiveState().isRunning) return
        reloadRagList()
        return
      }
      if (event?.type !== 'embed-failed' && event?.type !== 'embed-failure-cleared') return
      // 必须强制重拉：loadConfig() 对已缓存键是 no-op，否则失败条清了 UI 仍残留
      if (typeof settings.reloadConfigKeys === 'function') {
        void settings.reloadConfigKeys(['ragConfig'])
      } else {
        void settings.loadConfig?.({ force: true })
      }
    })

    return unsubscribe
  }, [reloadRagList, settings])

  const wasBatchEmbedRef = useRef(false)
  useEffect(() => {
    const running = activeRagState.isRunning && activeRagState.type === 'batchEmbed'
    if (running) {
      wasBatchEmbedRef.current = true
      return
    }
    if (!wasBatchEmbedRef.current) return
    wasBatchEmbedRef.current = false
    reloadRagList()
  }, [activeRagState.isRunning, activeRagState.type, reloadRagList])

  const invalidateInFlightListQuery = () => {
    dataGenerationRef.current += 1
    setIsSearching(true)
  }

  const handleSearch = (q: string, mode: 'semantic' | 'text') => {
    invalidateInFlightListQuery()
    setSearchQuery(q)
    setSearchMode(mode)
    setCurrentPage(1)
  }

  const handleSourceKindChange = (kind: RagVectorKindFilter) => {
    if (kind === stateRef.current.sourceKind && stateRef.current.currentPage === 1) return
    invalidateInFlightListQuery()
    setSourceKind(kind)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number, size: number) => {
    if (page === stateRef.current.currentPage && size === stateRef.current.pageSize) return
    invalidateInFlightListQuery()
    setCurrentPage(page)
    setPageSize(size)
  }

  return {
    ragStats,
    ragEntries,
    ragTotalCount,
    currentPage,
    pageSize,
    isProcessing,
    activeRagState,
    hasMismatchModel,
    migrationState,
    searchQuery,
    searchMode,
    sourceKind,
    isSearching,
    setCurrentPage,
    setPageSize,
    loadRagData,
    handleDetectDimension,
    handleClearDimension,
    handleBatchEmbed,
    handlePauseBatchEmbed,
    handleResumeBatchEmbed,
    handleCancelBatchEmbed,
    handleAddManualMemory,
    handleTriggerMigration,
    handleCancelMigration,
    handleRestoreMigration,
    handleResumeMigration,
    handleClearAll,
    handleSearch,
    handleSourceKindChange,
    handlePageChange,
    handleDeleteEntry,
    handleEditEntry,
    handleExportEmbeddings,
    handleManageBackups
  }
}
