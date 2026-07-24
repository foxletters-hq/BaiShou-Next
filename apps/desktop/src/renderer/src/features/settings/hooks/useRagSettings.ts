import { useState, useEffect, useRef, useSyncExternalStore, useCallback } from 'react'
import { useRagSystem } from './useRagSystem'
import { useRagActions } from './useRagActions'
import { getCachedRagStats, setCachedRagStats, subscribeRagRuntime } from '../rag-runtime-cache'

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
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const stateRef = useRef({ searchQuery, searchMode, currentPage, pageSize })
  const dataGenerationRef = useRef(0)
  const checkMigrationStatusRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    stateRef.current = { searchQuery, searchMode, currentPage, pageSize }
  }, [searchQuery, searchMode, currentPage, pageSize])

  const isDataRequestStale = (generation: number) => generation !== dataGenerationRef.current

  const loadRagData = useCallback(
    async (
      q: string,
      mode: 'semantic' | 'text',
      page: number,
      size: number,
      generation = dataGenerationRef.current
    ) => {
      try {
        const limit = size
        const offset = (page - 1) * limit
        const params: any = { limit, offset, mode, withTotal: true }

        if (q && q.trim() !== '') {
          params.keyword = q
          if (mode === 'semantic') {
            params.limit = 50
            params.offset = 0
          }
        }

        const [statsResult, entriesResult] = await Promise.all([
          (window as any).api?.rag?.getStats(),
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
              loadRagData(q, mode, maxPage, size, generation)
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
        await checkMigrationStatusRef.current()
      } catch (err) {
        console.error('[SettingsPage] loadRagData failed:', err)
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
    if (!searchQuery.trim()) {
      setRagTotalCount(ragStats.totalCount)
    }
  }, [ragStats.totalCount, searchQuery])

  useEffect(() => {
    const generation = ++dataGenerationRef.current
    void loadRagData(searchQuery, searchMode, currentPage, pageSize, generation)
    return () => {
      dataGenerationRef.current += 1
    }
  }, [loadRagData, searchQuery, searchMode, currentPage, pageSize])

  useEffect(() => {
    const api = (window as any).api
    if (!api?.diary?.onSyncEvent) return

    const unsubscribe = api.diary.onSyncEvent((event: { type?: string }) => {
      if (event?.type !== 'embed-failed' && event?.type !== 'embed-failure-cleared') return
      // 必须强制重拉：loadConfig() 对已缓存键是 no-op，否则失败条清了 UI 仍残留
      if (typeof settings.reloadConfigKeys === 'function') {
        void settings.reloadConfigKeys(['ragConfig'])
      } else {
        void settings.loadConfig?.({ force: true })
      }
    })

    return unsubscribe
  }, [settings])

  const handleSearch = (q: string, mode: 'semantic' | 'text') => {
    setSearchQuery(q)
    setSearchMode(mode)
    setCurrentPage(1)
    loadRagData(q, mode, 1, pageSize)
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
    setCurrentPage,
    setPageSize,
    loadRagData,
    handleDetectDimension,
    handleClearDimension,
    handleBatchEmbed,
    handleAddManualMemory,
    handleTriggerMigration,
    handleCancelMigration,
    handleRestoreMigration,
    handleResumeMigration,
    handleClearAll: () => handleClearAll(prompt),
    handleSearch,
    handleDeleteEntry,
    handleEditEntry,
    handleExportEmbeddings,
    handleManageBackups
  }
}
