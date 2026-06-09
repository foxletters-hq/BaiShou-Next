import { useState, useEffect } from 'react'
import type { RecallItem, RecallTab } from './recall-dialog.types'

export function useRecallDialog(
  isOpen: boolean,
  items: RecallItem[],
  onSearch: (query: string, tab: RecallTab, mode?: 'semantic' | 'text') => void,
  onInject: (selectedItems: RecallItem[]) => void,
  onClose: () => void,
  searchMode: 'semantic' | 'text' = 'semantic'
) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<RecallTab>('diary')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isOpen || activeTab !== 'diary') return
    onSearch('', 'diary')
  }, [activeTab, isOpen, onSearch])

  useEffect(() => {
    if (!isOpen || activeTab !== 'memory') return undefined
    const timeoutId = setTimeout(() => {
      onSearch(searchQuery, 'memory', searchMode)
    }, 400)
    return () => clearTimeout(timeoutId)
  }, [searchQuery, searchMode, activeTab, isOpen, onSearch])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const switchTab = (tab: RecallTab) => {
    setActiveTab(tab)
    setSelectedIds(new Set())
    setSearchQuery('')
  }

  const handleInject = () => {
    const selected = items.filter((i) => selectedIds.has(i.id))
    onInject(selected)
    setSelectedIds(new Set())
    onClose()
  }

  return {
    searchQuery,
    setSearchQuery,
    activeTab,
    switchTab,
    selectedIds,
    toggleSelect,
    handleInject
  }
}
