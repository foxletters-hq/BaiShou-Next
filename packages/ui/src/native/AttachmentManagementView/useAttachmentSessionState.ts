import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { useNativeToast } from '../Toast'
import type { SessionAttachmentGroup } from './attachment-management.types'

export interface UseAttachmentSessionStateOptions {
  onDeleteSelected: (ids: string[]) => Promise<void>
  onDeleteFile?: (sessionId: string, fileName: string) => Promise<void>
}

export function useAttachmentSessionState(
  attachments: SessionAttachmentGroup[],
  { onDeleteSelected, onDeleteFile }: UseAttachmentSessionStateOptions
) {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useNativeToast()

  const [activeTab, setActiveTab] = useState<'all' | 'orphans'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentSessionPage, setCurrentSessionPage] = useState(1)
  const [sessionPageSize, setSessionPageSize] = useState(10)

  const orphans = attachments.filter((a) => a.isOrphan)
  const totalSizeMB = attachments.reduce((sum, item) => sum + (item.totalSizeMB ?? 0), 0)
  const totalFiles = attachments.reduce((sum, item) => sum + (item.fileCount ?? 0), 0)
  const orphanSizeMB = orphans.reduce((sum, item) => sum + (item.totalSizeMB ?? 0), 0)
  const displayList = activeTab === 'all' ? attachments : orphans

  const totalSessionPages = Math.max(1, Math.ceil(displayList.length / sessionPageSize))
  const pagedSessionList = React.useMemo(() => {
    const start = (currentSessionPage - 1) * sessionPageSize
    return displayList.slice(start, start + sessionPageSize)
  }, [displayList, currentSessionPage, sessionPageSize])

  React.useEffect(() => {
    setCurrentSessionPage(1)
  }, [activeTab, sessionPageSize])

  const handleSelectAll = () => {
    if (selectedIds.size === pagedSessionList.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pagedSessionList.map((a) => a.sessionId)))
    }
  }

  const toggleSelect = (id: string, isChecked: boolean) => {
    const clone = new Set(selectedIds)
    if (isChecked) clone.add(id)
    else clone.delete(id)
    setSelectedIds(clone)
  }

  const toggleExpand = (id: string) => {
    const clone = new Set(expandedIds)
    if (clone.has(id)) clone.delete(id)
    else clone.add(id)
    setExpandedIds(clone)
  }

  const handleDeleteGroups = async () => {
    if (selectedIds.size === 0) return
    let confirmMsg = t(
      'settings.attachment_delete_selected_confirm',
      '确定要删除选中的 $count 个会话的附件文件夹吗？此操作不可撤销。'
    )
    if (confirmMsg.includes('$count')) {
      confirmMsg = confirmMsg.replace('$count', selectedIds.size.toString())
    }
    const confirmed = await dialog.confirm(confirmMsg, {
      title: t('settings.attachment_clear_confirm_title'),
      confirmText: t('common.delete'),
      destructive: true
    })
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await onDeleteSelected(Array.from(selectedIds))
      toast.showSuccess(t('settings.attachment_clear_completed', '清理完成'))
      setSelectedIds(new Set())
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(`${t('common.error', '错误')}: ${message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteSingleGroup = async (sessionId: string) => {
    const confirmed = await dialog.confirm(
      t('settings.attachment_delete_group_confirm', '确定要删除该会话的所有附件吗？此操作不可撤销。'),
      {
        title: t('settings.attachment_clear_confirm_title'),
        confirmText: t('common.delete'),
        destructive: true
      }
    )
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await onDeleteSelected([sessionId])
      toast.showSuccess(t('settings.attachment_clear_completed', '清理完成'))
      const clone = new Set(selectedIds)
      clone.delete(sessionId)
      setSelectedIds(clone)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(`${t('common.error', '错误')}: ${message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteSingleFile = async (sessionId: string, name: string) => {
    if (!onDeleteFile) return
    const confirmed = await dialog.confirm(
      t('settings.attachment_delete_file_confirm', '确定要删除该文件吗？此操作不可撤销。'),
      {
        title: t('settings.attachment_clear_confirm_title'),
        confirmText: t('common.delete'),
        destructive: true
      }
    )
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await onDeleteFile(sessionId, name)
      toast.showSuccess(t('settings.attachment_file_deleted', '文件已成功删除'))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(`${t('common.error', '错误')}: ${message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  return {
    activeTab,
    setActiveTab,
    selectedIds,
    setSelectedIds,
    expandedIds,
    isDeleting,
    currentSessionPage,
    setCurrentSessionPage,
    sessionPageSize,
    setSessionPageSize,
    orphans,
    totalSizeMB,
    totalFiles,
    orphanSizeMB,
    displayList,
    totalSessionPages,
    pagedSessionList,
    handleSelectAll,
    toggleSelect,
    toggleExpand,
    handleDeleteGroups,
    handleDeleteSingleGroup,
    handleDeleteSingleFile
  }
}
