import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { useRagSystem } from './useRagSystem'
import { useRagActions } from './useRagActions'
import {
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
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const stateRef = useRef({ searchQuery, searchMode, currentPage, pageSize })
  useEffect(() => {
    stateRef.current = { searchQuery, searchMode, currentPage, pageSize }
  }, [searchQuery, searchMode, currentPage, pageSize])

  const loadRagData = async (q: string, mode: 'semantic' | 'text', page: number, size: number) => {
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
            loadRagData(q, mode, maxPage, size)
            return
          }
          if (q && q.trim() !== '' && mode === 'semantic') {
            const allEntries = res.entries
            const semanticTotal = res.total
            const sliced = allEntries.slice((page - 1) * size, page * size)
            setRagEntries(sliced)
            setRagTotalCount(semanticTotal)
          } else {
            setRagEntries(res.entries)
            setRagTotalCount(res.total)
          }
        } else {
          setRagEntries(res)
          setRagTotalCount(s ? s.totalCount || 0 : 0)
        }
      } else if (s) {
        setRagTotalCount(s.totalCount || 0)
      }

      await checkMigrationStatus()
    } catch (err) {
      console.error('[SettingsPage] loadRagData failed:', err)
    }
  }

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
  } = useRagSystem(t, toast, confirm, alert, fetchRagInfo, settings.loadConfig)

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
    loadRagData(searchQuery, searchMode, currentPage, pageSize)
    void checkMigrationStatus()
  }, [])

  useEffect(() => {
    const api = (window as any).api
    if (!api?.diary?.onSyncEvent) return

    const unsubscribe = api.diary.onSyncEvent((event: { type?: string }) => {
      if (event?.type !== 'embed-failed' && event?.type !== 'embed-failure-cleared') return
      void settings.loadConfig?.()
    })

    return unsubscribe
  }, [settings.loadConfig])

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
