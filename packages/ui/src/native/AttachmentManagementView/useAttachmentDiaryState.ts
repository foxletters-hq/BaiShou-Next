import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { useNativeToast } from '../Toast'
import type { DiaryAttachmentFileItem } from './attachment-management.types'

export interface UseAttachmentDiaryStateOptions {
  onDeleteDiaryAttachment?: (filePath: string) => Promise<void>
  confirmKeyword: string
  toDisplayUri: (path: string) => string
  imagePreview: { src: string; name: string } | null
  setImagePreview: React.Dispatch<React.SetStateAction<{ src: string; name: string } | null>>
}

export function useAttachmentDiaryState(
  diaryAttachments: DiaryAttachmentFileItem[],
  activePane: 'session' | 'diary',
  {
    onDeleteDiaryAttachment,
    confirmKeyword,
    toDisplayUri,
    imagePreview,
    setImagePreview
  }: UseAttachmentDiaryStateOptions
) {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useNativeToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const [diaryYear, setDiaryYear] = useState('all')
  const [diaryMonth, setDiaryMonth] = useState('all')
  const [diaryOrphanOnly, setDiaryOrphanOnly] = useState(false)
  const [selectedDiaryPaths, setSelectedDiaryPaths] = useState<Set<string>>(new Set())
  const [currentDiaryPage, setCurrentDiaryPage] = useState(1)
  const [diaryPageSize, setDiaryPageSize] = useState(10)

  const availableYears = React.useMemo(() => {
    const years = new Set<string>()
    diaryAttachments.forEach((item) => {
      const y = item.yearMonth.split('-')[0]
      if (y) years.add(y)
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [diaryAttachments])

  const filteredDiaryAttachments = React.useMemo(() => {
    return diaryAttachments.filter((item) => {
      const [y, m] = item.yearMonth.split('-')
      if (diaryYear !== 'all' && y !== diaryYear) return false
      if (diaryMonth !== 'all' && m !== diaryMonth) return false
      if (diaryOrphanOnly && !item.isOrphan) return false
      return true
    })
  }, [diaryAttachments, diaryYear, diaryMonth, diaryOrphanOnly])

  React.useEffect(() => {
    setCurrentDiaryPage(1)
    setSelectedDiaryPaths(new Set())
  }, [diaryYear, diaryMonth, diaryOrphanOnly, activePane, diaryPageSize])

  const totalDiaryPages = Math.max(1, Math.ceil(filteredDiaryAttachments.length / diaryPageSize))
  const pagedDiaryAttachments = React.useMemo(() => {
    const start = (currentDiaryPage - 1) * diaryPageSize
    return filteredDiaryAttachments.slice(start, start + diaryPageSize)
  }, [filteredDiaryAttachments, currentDiaryPage, diaryPageSize])

  const diaryTotalSizeMB = diaryAttachments.reduce((sum, item) => sum + item.sizeMB, 0)
  const diaryOrphanSizeMB = diaryAttachments
    .filter((d) => d.isOrphan)
    .reduce((sum, item) => sum + item.sizeMB, 0)

  const handleDeleteDiarySingle = async (filePath: string) => {
    if (!onDeleteDiaryAttachment) return

    const targetItem = diaryAttachments.find((item) => item.path === filePath)
    const isOrphan = targetItem ? targetItem.isOrphan : true

    if (!isOrphan) {
      const userInput = await dialog.prompt(
        t(
          'settings.attachment_delete_referenced_prompt',
          '该附件已被日记引用，删除可能导致日记内容中链接失效。\n请输入「确定」以确认删除：'
        ),
        '',
        t('settings.attachment_delete_referenced_title', '警告：正在删除已引用的附件')
      )
      if (userInput !== confirmKeyword) {
        toast.showError(t('settings.attachment_delete_mismatch', '输入内容不符，已取消删除'))
        return
      }
    } else {
      const confirmed = await dialog.confirm(
        t('settings.attachment_delete_file_confirm', '确定要删除该文件吗？此操作不可撤销。'),
        {
          title: t('settings.attachment_clear_confirm_title'),
          confirmText: t('common.delete'),
          destructive: true
        }
      )
      if (!confirmed) return
    }

    setIsDeleting(true)
    try {
      await onDeleteDiaryAttachment(filePath)
      toast.showSuccess(t('settings.attachment_file_deleted', '文件已成功删除'))
      const clone = new Set(selectedDiaryPaths)
      clone.delete(filePath)
      setSelectedDiaryPaths(clone)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(`${t('common.error', '错误')}: ${message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteDiarySelected = async () => {
    if (!onDeleteDiaryAttachment || selectedDiaryPaths.size === 0) return

    const hasReferenced = Array.from(selectedDiaryPaths).some((p) => {
      const item = diaryAttachments.find((item) => item.path === p)
      return item ? !item.isOrphan : false
    })

    if (hasReferenced) {
      const userInput = await dialog.prompt(
        t(
          'settings.attachment_delete_referenced_batch_prompt',
          '选中的附件中包含已被日记引用的文件，删除可能导致链接失效。\n请输入「确定」以确认批量删除选中的 $count 个文件：'
        ).replace('$count', selectedDiaryPaths.size.toString()),
        '',
        t('settings.attachment_delete_referenced_title', '警告：正在删除已引用的附件')
      )
      if (userInput !== confirmKeyword) {
        toast.showError(t('settings.attachment_delete_mismatch', '输入内容不符，已取消删除'))
        return
      }
    } else {
      const confirmed = await dialog.confirm(
        t(
          'settings.attachment_delete_selected_confirm',
          '确定要删除选中的 $count 个文件吗？此操作不可撤销。'
        ).replace('$count', selectedDiaryPaths.size.toString()),
        {
          title: t('settings.attachment_clear_confirm_title'),
          confirmText: t('common.delete'),
          destructive: true
        }
      )
      if (!confirmed) return
    }

    setIsDeleting(true)
    try {
      await Promise.all(Array.from(selectedDiaryPaths).map((p) => onDeleteDiaryAttachment(p)))
      toast.showSuccess(t('settings.attachment_clear_completed', '清理完成'))
      setSelectedDiaryPaths(new Set())
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(`${t('common.error', '错误')}: ${message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSelectDiary = (pathStr: string, isChecked: boolean) => {
    const clone = new Set(selectedDiaryPaths)
    if (isChecked) clone.add(pathStr)
    else clone.delete(pathStr)
    setSelectedDiaryPaths(clone)
  }

  const toggleSelectAllDiary = () => {
    if (selectedDiaryPaths.size === pagedDiaryAttachments.length) {
      setSelectedDiaryPaths(new Set())
    } else {
      setSelectedDiaryPaths(new Set(pagedDiaryAttachments.map((f) => f.path)))
    }
  }

  return {
    diaryYear,
    setDiaryYear,
    diaryMonth,
    setDiaryMonth,
    diaryOrphanOnly,
    setDiaryOrphanOnly,
    selectedDiaryPaths,
    currentDiaryPage,
    setCurrentDiaryPage,
    diaryPageSize,
    setDiaryPageSize,
    availableYears,
    filteredDiaryAttachments,
    totalDiaryPages,
    pagedDiaryAttachments,
    diaryTotalSizeMB,
    diaryOrphanSizeMB,
    handleDeleteDiarySingle,
    handleDeleteDiarySelected,
    toggleSelectDiary,
    toggleSelectAllDiary,
    isDeleting
  }
}
