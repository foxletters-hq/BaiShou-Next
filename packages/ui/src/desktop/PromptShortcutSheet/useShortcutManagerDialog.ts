import { useState, useMemo } from 'react'
import {
  CREATE_SKILL_SLASH_COMMAND,
  findShortcutCommandConflict,
  getCreateSkillGuidePrompt
} from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'
import type { PromptShortcut } from './index'

export const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30] as const

/** 管理列表置顶的「创建 Skill」虚拟项 */
export const CREATE_SKILL_MANAGER_ID = '__create-skill__'

export function isProtectedSkill(shortcut: {
  id?: string
  command?: string
  name?: string
}): boolean {
  const id = (shortcut.id || '').trim()
  const command = (shortcut.command || shortcut.name || '').trim().replace(/^\//, '')
  return (
    id === CREATE_SKILL_MANAGER_ID ||
    id === CREATE_SKILL_SLASH_COMMAND ||
    command === CREATE_SKILL_SLASH_COMMAND
  )
}

/** @deprecated 使用 isProtectedSkill；仅 create-skill 不可删 */
export const isDefaultShortcut = (id: string) =>
  id === CREATE_SKILL_MANAGER_ID || id === CREATE_SKILL_SLASH_COMMAND

function buildManagerList(
  shortcuts: PromptShortcut[],
  t: (key: string, fallback: string) => string
): PromptShortcut[] {
  const createItem: PromptShortcut = {
    id: CREATE_SKILL_MANAGER_ID,
    command: CREATE_SKILL_SLASH_COMMAND,
    name: CREATE_SKILL_SLASH_COMMAND,
    description: CREATE_SKILL_SLASH_COMMAND,
    content: getCreateSkillGuidePrompt(t),
    tag: CREATE_SKILL_SLASH_COMMAND
  }
  const rest = shortcuts.filter((item) => !isProtectedSkill(item))
  return [createItem, ...rest]
}

export function useShortcutManagerDialog(
  shortcuts: PromptShortcut[],
  onAdd: (shortcut: PromptShortcut) => Promise<void>,
  onUpdate: (shortcut: PromptShortcut) => Promise<void>
) {
  const { t } = useTranslation()
  const toast = useToast()
  const [editingItem, setEditingItem] = useState<PromptShortcut | null>(null)
  const [draftId, setDraftId] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftCommand, setDraftCommand] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const managerShortcuts = useMemo(() => buildManagerList(shortcuts, t), [shortcuts, t])

  const totalPages = Math.max(1, Math.ceil(managerShortcuts.length / pageSize))
  const paginatedShortcuts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return managerShortcuts.slice(startIndex, startIndex + pageSize)
  }, [managerShortcuts, currentPage, pageSize])

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page)
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  const handleEdit = (item: PromptShortcut) => {
    if (isProtectedSkill(item)) return
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
    const isNew = editingItem.id === 'new'
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

    if (isProtectedSkill(newItem)) {
      toast.showError(t('shortcut.reserved_command', '该名称已保留，请换一个 Skill 名称'))
      return
    }

    if (findShortcutCommandConflict(shortcuts, newItem, isNew ? undefined : newItem.id)) {
      toast.showError(t('shortcut.duplicate_command', '已存在相同名称的 Skill，请换一个名称'))
      return
    }

    try {
      if (isNew) {
        await onAdd(newItem)
      } else {
        await onUpdate(newItem)
      }
      setEditingItem(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (
        message === 'DUPLICATE_SHORTCUT_COMMAND' ||
        message === 'DUPLICATE_SKILL_NAME' ||
        message.includes('DUPLICATE_SKILL_NAME')
      ) {
        toast.showError(t('shortcut.duplicate_command', '已存在相同名称的 Skill，请换一个名称'))
        return
      }
      throw error
    }
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
    managerShortcuts,
    paginatedShortcuts,
    handlePageChange,
    handlePageSizeChange,
    handleEdit,
    handleCreateNew,
    handleSave,
    clearEditing
  }
}
