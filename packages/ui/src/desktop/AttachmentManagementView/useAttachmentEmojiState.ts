import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import type { EmojiAttachmentListItem } from './attachment-management.types'

export function useAttachmentEmojiState(
  emojiAttachments: EmojiAttachmentListItem[],
  activePane: 'session' | 'diary' | 'emoji',
  {
    onDeleteEmojiAttachments,
    confirmKeyword
  }: {
    onDeleteEmojiAttachments?: (relativePaths: string[]) => Promise<void>
    confirmKeyword: string
  }
) {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const [isDeletingEmoji, setIsDeletingEmoji] = useState(false)
  const [selectedEmojiPaths, setSelectedEmojiPaths] = useState<Set<string>>(new Set())
  const [currentEmojiPage, setCurrentEmojiPage] = useState(1)
  const [emojiPageSize, setEmojiPageSize] = useState(10)

  const emojiTotalSizeMB = React.useMemo(
    () => emojiAttachments.reduce((sum, item) => sum + item.sizeMB, 0),
    [emojiAttachments]
  )
  const emojiUnusedCount = React.useMemo(
    () => emojiAttachments.filter((item) => item.groupNames.length === 0 || item.isMissing).length,
    [emojiAttachments]
  )

  const totalEmojiPages = Math.max(1, Math.ceil(emojiAttachments.length / emojiPageSize))
  const pagedEmojiAttachments = React.useMemo(() => {
    const start = (currentEmojiPage - 1) * emojiPageSize
    return emojiAttachments.slice(start, start + emojiPageSize)
  }, [emojiAttachments, currentEmojiPage, emojiPageSize])

  React.useEffect(() => {
    if (currentEmojiPage > totalEmojiPages) setCurrentEmojiPage(totalEmojiPages)
  }, [currentEmojiPage, totalEmojiPages])

  React.useEffect(() => {
    if (activePane !== 'emoji') setSelectedEmojiPaths(new Set())
  }, [activePane])

  const toggleSelectEmoji = (relativePath: string, checked: boolean) => {
    setSelectedEmojiPaths((prev) => {
      const next = new Set(prev)
      if (checked) next.add(relativePath)
      else next.delete(relativePath)
      return next
    })
  }

  const toggleSelectAllEmoji = () => {
    if (selectedEmojiPaths.size === pagedEmojiAttachments.length) {
      setSelectedEmojiPaths(new Set())
      return
    }
    setSelectedEmojiPaths(new Set(pagedEmojiAttachments.map((item) => item.relativePath)))
  }

  const confirmDelete = async (items: EmojiAttachmentListItem[]) => {
    const inGroup = items.some((item) => item.groupNames.length > 0)
    if (inGroup) {
      const userInput = await dialog.prompt(
        t(
          'settings.emoji_attachment_delete_in_group_prompt',
          '选中的表情包仍在表情包组里。删除后组里不会再显示，伙伴也无法发出。\n请输入“确定”以确认删除：'
        ),
        '',
        t('settings.emoji_attachment_delete_title', '删除表情包附件')
      )
      if (userInput !== confirmKeyword) {
        toast.showError(t('settings.attachment_delete_mismatch', '输入内容不符，已取消删除'))
        return false
      }
      return true
    }
    return dialog.confirm(
      t('settings.attachment_delete_file_confirm', '确定要删除该文件吗？此操作不可撤销。')
    )
  }

  const handleDeleteEmojiSelected = async () => {
    if (!onDeleteEmojiAttachments || selectedEmojiPaths.size === 0) return
    const items = emojiAttachments.filter((item) => selectedEmojiPaths.has(item.relativePath))
    if (!(await confirmDelete(items))) return
    setIsDeletingEmoji(true)
    try {
      await onDeleteEmojiAttachments(Array.from(selectedEmojiPaths))
      toast.showSuccess(t('settings.attachment_file_deleted', '文件已成功删除'))
      setSelectedEmojiPaths(new Set())
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(`${t('common.error', '错误')}: ${message}`)
    } finally {
      setIsDeletingEmoji(false)
    }
  }

  const handleDeleteEmojiSingle = async (relativePath: string) => {
    if (!onDeleteEmojiAttachments) return
    const item = emojiAttachments.find((entry) => entry.relativePath === relativePath)
    if (!item) return
    if (!(await confirmDelete([item]))) return
    setIsDeletingEmoji(true)
    try {
      await onDeleteEmojiAttachments([relativePath])
      toast.showSuccess(t('settings.attachment_file_deleted', '文件已成功删除'))
      setSelectedEmojiPaths((prev) => {
        const next = new Set(prev)
        next.delete(relativePath)
        return next
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(`${t('common.error', '错误')}: ${message}`)
    } finally {
      setIsDeletingEmoji(false)
    }
  }

  return {
    emojiAttachments,
    onDeleteEmojiAttachments,
    emojiTotalSizeMB,
    emojiUnusedCount,
    selectedEmojiPaths,
    currentEmojiPage,
    setCurrentEmojiPage,
    emojiPageSize,
    setEmojiPageSize,
    totalEmojiPages,
    pagedEmojiAttachments,
    toggleSelectEmoji,
    toggleSelectAllEmoji,
    handleDeleteEmojiSelected,
    handleDeleteEmojiSingle,
    isDeletingEmoji
  }
}
