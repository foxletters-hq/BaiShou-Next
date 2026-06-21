import { useState, useMemo, useCallback } from 'react'
import type { DeleteTarget, SessionInfo } from './session-management.types'

interface UseSessionManagementPageOptions {
  sessions: SessionInfo[]
  onDeleteSession: (sessionId: string) => void
  onDeleteMultiple: (sessionIds: string[]) => void
}

export function useSessionManagementPage({
  sessions,
  onDeleteSession,
  onDeleteMultiple
}: UseSessionManagementPageOptions) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'pinned'>('all')
  const [isMultiSelect, setIsMultiSelect] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const filteredAndSortedSessions = useMemo(() => {
    let result = [...sessions]

    if (filterMode === 'pinned') {
      result = result.filter((s) => s.isPinned)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (s) => s.title.toLowerCase().includes(q) || s.assistantName.toLowerCase().includes(q)
      )
    }

    return result.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return b.updatedAt.getTime() - a.updatedAt.getTime()
    })
  }, [sessions, filterMode, searchQuery])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredAndSortedSessions.map((s) => s.id)))
  }, [filteredAndSortedSessions])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setIsMultiSelect(false)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'single' && deleteTarget.id) {
      onDeleteSession(deleteTarget.id)
    } else if (deleteTarget.type === 'multiple') {
      onDeleteMultiple([...selectedIds])
      clearSelection()
    }
    setDeleteTarget(null)
  }, [deleteTarget, selectedIds, onDeleteSession, onDeleteMultiple, clearSelection])

  return {
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    isMultiSelect,
    setIsMultiSelect,
    selectedIds,
    deleteTarget,
    setDeleteTarget,
    filteredAndSortedSessions,
    toggleSelect,
    selectAll,
    clearSelection,
    handleConfirmDelete
  }
}
