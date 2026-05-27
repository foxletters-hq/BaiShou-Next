import { useState } from 'react'
import type { RagState } from './rag-memory.types'

interface UseRagMemoryViewOptions {
  totalCount?: number
  entriesLength: number
  propCurrentPage?: number
  propPageSize?: number
  onSearch?: (query: string, mode: 'semantic' | 'text') => void
  onPageChange?: (page: number, pageSize: number) => void
}

export function useRagMemoryView({
  totalCount,
  entriesLength,
  propCurrentPage,
  propPageSize,
  onSearch,
  onPageChange
}: UseRagMemoryViewOptions) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [searchMode, setSearchMode] = useState<'semantic' | 'text'>('semantic')
  const [internalCurrentPage, setInternalCurrentPage] = useState(1)
  const [internalPageSize, setInternalPageSize] = useState(10)

  const currentPage = propCurrentPage !== undefined ? propCurrentPage : internalCurrentPage
  const pageSize = propPageSize !== undefined ? propPageSize : internalPageSize

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setSearchQuery(v)
    setInternalCurrentPage(1)
    onSearch?.(v, searchMode)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setInternalCurrentPage(1)
    onSearch?.('', searchMode)
  }

  const toggleSearchMode = () => {
    const newMode = searchMode === 'semantic' ? 'text' : 'semantic'
    setSearchMode(newMode)
    setInternalCurrentPage(1)
    onSearch?.(searchQuery, newMode)
  }

  const handlePageChange = (page: number) => {
    setInternalCurrentPage(page)
    onPageChange?.(page, pageSize)
  }

  const handlePageSizeChange = (newSize: number) => {
    setInternalPageSize(newSize)
    setInternalCurrentPage(1)
    onPageChange?.(1, newSize)
  }

  const effectiveTotal = totalCount ?? entriesLength
  const showPagination = effectiveTotal > 10
  const totalPages = Math.ceil(effectiveTotal / pageSize)

  return {
    searchQuery,
    activeMenuId,
    setActiveMenuId,
    searchMode,
    currentPage,
    pageSize,
    effectiveTotal,
    showPagination,
    totalPages,
    handleSearch,
    handleClearSearch,
    toggleSearchMode,
    handlePageChange,
    handlePageSizeChange
  }
}

export function getRagBusyFlags(ragState: RagState) {
  return {
    isBusy: ragState.isRunning,
    isMigrating: ragState.isRunning && ragState.type === 'migration',
    isBatchEmbedding: ragState.isRunning && ragState.type === 'batchEmbed'
  }
}
