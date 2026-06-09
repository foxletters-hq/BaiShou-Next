import { useEffect, useMemo, useState } from 'react'
import type { PromptShortcut } from '@baishou/shared'

export const SHORTCUT_PAGE_SIZE = 10

export function mergePageReorder(
  shortcuts: PromptShortcut[],
  pageStart: number,
  pageSize: number,
  reorderedPage: PromptShortcut[]
): PromptShortcut[] {
  const end = pageStart + pageSize
  return [...shortcuts.slice(0, pageStart), ...reorderedPage, ...shortcuts.slice(end)]
}

export function usePromptShortcutSheet(shortcuts: PromptShortcut[]) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = SHORTCUT_PAGE_SIZE

  const filteredShortcuts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return shortcuts
    return shortcuts.filter(
      (item) =>
        (item.name || '').toLowerCase().includes(query) ||
        (item.content || '').toLowerCase().includes(query)
    )
  }, [searchQuery, shortcuts])

  const totalPages = Math.max(1, Math.ceil(filteredShortcuts.length / pageSize))
  const effectivePage = Math.min(currentPage, totalPages)

  useEffect(() => {
    if (currentPage !== effectivePage) {
      setCurrentPage(effectivePage)
    }
  }, [currentPage, effectivePage])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const pageStartIndex = (effectivePage - 1) * pageSize

  const paginatedShortcuts = useMemo(
    () => filteredShortcuts.slice(pageStartIndex, pageStartIndex + pageSize),
    [filteredShortcuts, pageStartIndex, pageSize]
  )

  const isSearchActive = searchQuery.trim().length > 0

  return {
    searchQuery,
    setSearchQuery,
    currentPage: effectivePage,
    setCurrentPage,
    pageSize,
    filteredShortcuts,
    paginatedShortcuts,
    totalPages,
    pageStartIndex,
    isSearchActive,
    canDrag: !isSearchActive
  }
}
