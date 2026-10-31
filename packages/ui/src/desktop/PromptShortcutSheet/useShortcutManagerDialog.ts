import { useEffect, useMemo, useState } from 'react'
import {
  CREATE_SKILL_MANAGER_ID,
  CREATE_SKILL_SLASH_COMMAND,
  DEFAULT_AGENT_SKILLS,
  dedupePromptShortcuts,
  findShortcutCommandConflict,
  getCreateSkillGuidePrompt,
  isProtectedSkill,
  skillToPromptShortcut
} from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'
import type { PromptShortcut } from './index'

export const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30] as const

export { CREATE_SKILL_MANAGER_ID, isProtectedSkill }

/** @deprecated 使用 isProtectedSkill；内置 Skill 不可删改 */
export const isDefaultShortcut = (id: string) => isProtectedSkill({ id })

function buildManagerList(
  shortcuts: PromptShortcut[],
  t: (key: string, fallback: string) => string
): PromptShortcut[] {
  const builtinItems: PromptShortcut[] = DEFAULT_AGENT_SKILLS.map((skill) =>
    skill.name === CREATE_SKILL_SLASH_COMMAND
      ? {
          id: CREATE_SKILL_MANAGER_ID,
          command: CREATE_SKILL_SLASH_COMMAND,
          name: CREATE_SKILL_SLASH_COMMAND,
          description: CREATE_SKILL_SLASH_COMMAND,
          content: getCreateSkillGuidePrompt(t),
          tag: CREATE_SKILL_SLASH_COMMAND,
          source: 'software' as const
        }
      : skillToPromptShortcut({
          name: skill.name,
          description: skill.description,
          content: skill.content,
          location: 'software',
          source: 'software'
        })
  )
  const rest = shortcuts.filter((item) => !isProtectedSkill(item))
  return dedupePromptShortcuts([...builtinItems, ...rest])
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
  // 删除条目后总页数可能变小，夹紧当前页避免停留在空白页
  const safePage = Math.min(currentPage, totalPages)

  useEffect(() => {
    if (currentPage !== safePage) setCurrentPage(safePage)
  }, [currentPage, safePage])

  const paginatedShortcuts = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize
    return managerShortcuts.slice(startIndex, startIndex + pageSize)
  }, [managerShortcuts, safePage, pageSize])

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
    setDraftName(item.description || item.name || item.tag || '')
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
      description: draftName,
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
    currentPage: safePage,
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
