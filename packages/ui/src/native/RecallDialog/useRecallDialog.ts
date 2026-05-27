import { useState, useEffect } from 'react'
import type { RecallItem, RecallTab } from './recall-dialog.types'

export function useRecallDialog(
  isOpen: boolean,
  items: RecallItem[],
  onSearch: (query: string, tab: RecallTab) => void,
  onInject: (selectedItems: RecallItem[]) => void,
  onClose: () => void
) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<RecallTab>('diary')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cleanup: (() => void) | undefined
    if (isOpen) {
      const timeoutId = setTimeout(() => {
        onSearch(searchQuery, activeTab)
      }, 400)
      cleanup = () => {
        clearTimeout(timeoutId)
      }
    }
    return cleanup
  }, [searchQuery, activeTab, isOpen, onSearch])

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
