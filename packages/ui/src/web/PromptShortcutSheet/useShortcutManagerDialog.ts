import { useState, useMemo } from 'react'
import type { PromptShortcut } from './index'

export const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30] as const

export function useShortcutManagerDialog(
  shortcuts: PromptShortcut[],
  onAdd: (shortcut: PromptShortcut) => Promise<void>,
  onUpdate: (shortcut: PromptShortcut) => Promise<void>
) {
  const [editingItem, setEditingItem] = useState<PromptShortcut | null>(null)
  const [draftId, setDraftId] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftCommand, setDraftCommand] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const totalPages = Math.max(1, Math.ceil(shortcuts.length / pageSize))
  const paginatedShortcuts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return shortcuts.slice(startIndex, startIndex + pageSize)
  }, [shortcuts, currentPage, pageSize])

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page)
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  const handleEdit = (item: PromptShortcut) => {
    setEditingItem(item)
    setDraftId(item.id)
    setDraftName(item.name || item.tag || '')
    setDraftCommand(item.command || '')
    setDraftContent(item.content || '')
  }

  const handleCreateNew = () => {
    setEditingItem({ id: 'new', content: '' })
    setDraftId(`custom-${Date.now()}`)
    setDraftName('')
    setDraftCommand('')
    setDraftContent('')
  }

  const handleSave = async () => {
    if (!draftContent.trim() || !editingItem) return
    const newItem: PromptShortcut = {
      ...editingItem,
      id: draftId,
      name: draftName,
      tag: draftName,
      content: draftContent,
      command:
        draftCommand ||
        draftName ||
        draftContent.trim().substring(0, 20).replace(/\n/g, '') ||
        'shortcut'
    }
    if (editingItem.id === 'new') {
      await onAdd(newItem)
    } else {
      await onUpdate(newItem)
    }
    setEditingItem(null)
  }

  const clearEditing = () => setEditingItem(null)

  return {
    editingItem,
    draftName,
    setDraftName,
    draftCommand,
    setDraftCommand,
    draftContent,
    setDraftContent,
    currentPage,
    pageSize,
    totalPages,
    paginatedShortcuts,
    handlePageChange,
    handlePageSizeChange,
    handleEdit,
    handleCreateNew,
    handleSave,
    clearEditing
  }
}

export const isDefaultShortcut = (id: string) => id.startsWith('default-')
