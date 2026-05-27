import { useState, useEffect, useRef } from 'react'
import { useRagSystem } from './useRagSystem'
import { useRagActions } from './useRagActions'

interface UseRagSettingsProps {
  settings: any
  t: any
  toast: any
  confirm: (message: string, title?: string) => Promise<boolean>
  prompt: (message: string, defaultValue?: string, title?: string, required?: boolean) => Promise<string | null>
  alert: (message: string, title?: string) => Promise<void>
}

export function useRagSettings({ settings, t, toast, confirm, prompt, alert }: UseRagSettingsProps) {
  const [ragStats, setRagStats] = useState<any>({
    totalCount: 0,
    currentDimension: 0,
    totalSizeText: '0 KB'
  })
  const [ragEntries, setRagEntries] = useState<any[]>([])
  const [ragTotalCount, setRagTotalCount] = useState(0)

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
      const s = await (window as any).api?.rag?.getStats()
      if (s) setRagStats(s)

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

      const res = await (window as any).api?.rag?.queryEntries(params)
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
    checkMigrationStatus,
    handleDetectDimension,
    handleClearDimension,
    handleBatchEmbed,
    handleTriggerMigration,
    handleClearAll
  } = useRagSystem(t, toast, confirm, alert, fetchRagInfo)

  const {
    handleAddManualMemory,
    handleDeleteEntry,
    handleEditEntry,
    handleExportEmbeddings,
    handleManageBackups
  } = useRagActions(t, toast, confirm, prompt, alert, fetchRagInfo, setIsProcessing)

  useEffect(() => {
    loadRagData(searchQuery, searchMode, currentPage, pageSize)
  }, [])

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
    handleClearAll: () => handleClearAll(prompt),
    handleSearch,
    handleDeleteEntry,
    handleEditEntry,
    handleExportEmbeddings,
    handleManageBackups
  }
}
