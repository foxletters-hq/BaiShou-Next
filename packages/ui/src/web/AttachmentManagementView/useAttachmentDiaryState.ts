import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import type { DiaryAttachmentFileItem } from './attachment-management.types'
import {
  formatAttachmentClearCompletedMessage,
  isImageFile,
  supportsLocalFileImagePreview,
  toLocalFileUrl
} from './attachment-management.utils'

const THUMBNAIL_LOAD_CONCURRENCY = 4

async function invokeGetThumbnail(filePath: string, maxSize: number): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    api?: { attachment?: { getThumbnail?: (p: string, s: number) => Promise<string | null> } }
    electron?: { ipcRenderer?: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> } }
  }
  if (w.api?.attachment?.getThumbnail) {
    return w.api.attachment.getThumbnail(filePath, maxSize)
  }
  if (w.electron?.ipcRenderer?.invoke) {
    return w.electron.ipcRenderer.invoke('attachment:getThumbnail', filePath, maxSize) as Promise<
      string | null
    >
  }
  return null
}

export interface UseAttachmentDiaryStateOptions {
  onDeleteDiaryAttachment?: (filePath: string) => Promise<void>
  confirmKeyword: string
  imagePreview: { src: string; name: string } | null
  setImagePreview: React.Dispatch<React.SetStateAction<{ src: string; name: string } | null>>
  imagePreviewLoading: boolean
  setImagePreviewLoading: React.Dispatch<React.SetStateAction<boolean>>
  fullImageCacheRef: React.MutableRefObject<Map<string, string>>
}

export function useAttachmentDiaryState(
  diaryAttachments: DiaryAttachmentFileItem[],
  activePane: 'session' | 'diary',
  thumbnailCache: Map<string, string>,
  setThumbnailCache: React.Dispatch<React.SetStateAction<Map<string, string>>>,
  thumbnailLoadingRef: React.MutableRefObject<Set<string>>,
  {
    onDeleteDiaryAttachment,
    confirmKeyword,
    imagePreview,
    setImagePreview,
    imagePreviewLoading,
    setImagePreviewLoading,
    fullImageCacheRef
  }: UseAttachmentDiaryStateOptions
) {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const [diaryYear, setDiaryYear] = useState<string>('all')
  const [diaryMonth, setDiaryMonth] = useState<string>('all')
  const [diaryOrphanOnly, setDiaryOrphanOnly] = useState<boolean>(false)
  const [selectedDiaryPaths, setSelectedDiaryPaths] = useState<Set<string>>(new Set())
  const [currentDiaryPage, setCurrentDiaryPage] = useState<number>(1)
  const [diaryPageSize, setDiaryPageSize] = useState<number>(10)

  // 动态生成有附件的年份选项
  const availableYears = React.useMemo(() => {
    const years = new Set<string>()
    diaryAttachments.forEach((item) => {
      const y = item.yearMonth.split('-')[0]
      if (y) years.add(y)
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [diaryAttachments])

  // 执行日记附件的多级过滤
  const filteredDiaryAttachments = React.useMemo(() => {
    return diaryAttachments.filter((item) => {
      const [y, m] = item.yearMonth.split('-')
      if (diaryYear !== 'all' && y !== diaryYear) return false
      if (diaryMonth !== 'all' && m !== diaryMonth) return false
      if (diaryOrphanOnly && !item.isOrphan) return false
      return true
    })
  }, [diaryAttachments, diaryYear, diaryMonth, diaryOrphanOnly])

  // 重置分页在筛选变动时
  React.useEffect(() => {
    setCurrentDiaryPage(1)
    setSelectedDiaryPaths(new Set())
  }, [diaryYear, diaryMonth, diaryOrphanOnly, activePane, diaryPageSize])

  // 日记分页数据切片
  const totalDiaryPages = Math.max(1, Math.ceil(filteredDiaryAttachments.length / diaryPageSize))
  const pagedDiaryAttachments = React.useMemo(() => {
    const start = (currentDiaryPage - 1) * diaryPageSize
    return filteredDiaryAttachments.slice(start, start + diaryPageSize)
  }, [filteredDiaryAttachments, currentDiaryPage, diaryPageSize])

  // 日记附件总占用大小和孤立占用大小
  const diaryTotalSizeMB = diaryAttachments.reduce((sum, item) => sum + item.sizeMB, 0)
  const diaryOrphanSizeMB = diaryAttachments
    .filter((d) => d.isOrphan)
    .reduce((sum, item) => sum + item.sizeMB, 0)

  // 获取缩略图
  const getThumbnail = async (filePath: string) => {
    if (thumbnailCache.has(filePath)) {
      return thumbnailCache.get(filePath)!
    }

    // 防止重复加载
    if (thumbnailLoadingRef.current.has(filePath)) {
      return null
    }
    thumbnailLoadingRef.current.add(filePath)

    try {
      const thumbnail = await invokeGetThumbnail(filePath, 200)
      if (thumbnail) {
        setThumbnailCache((prev) => new Map(prev).set(filePath, thumbnail))
        return thumbnail
      }
    } catch (e) {
      console.error('Failed to load thumbnail:', e)
    } finally {
      thumbnailLoadingRef.current.delete(filePath)
    }
    return null
  }

  // 获取原图（用于预览）
  const getFullImage = async (filePath: string) => {
    if (fullImageCacheRef.current.has(filePath)) {
      return fullImageCacheRef.current.get(filePath)!
    }

    try {
      if (typeof window !== 'undefined') {
        const w = window as any
        const imageData = w.api?.attachment?.getFullImage
          ? await w.api.attachment.getFullImage(filePath)
          : w.electron
            ? await w.electron.ipcRenderer.invoke('attachment:getFullImage', filePath)
            : null
        if (imageData) {
          fullImageCacheRef.current.set(filePath, imageData)
          return imageData
        }
      }
    } catch (e) {
      console.error('Failed to load full image:', e)
    }
    return null
  }

  const handleOpenImagePreview = async (filePath: string, fileName: string) => {
    if (imagePreviewLoading) return

    const cachedFull = fullImageCacheRef.current.get(filePath)
    const thumb = thumbnailCache.get(filePath)
    if (cachedFull) {
      setImagePreview({ src: cachedFull, name: fileName })
      return
    }

    if (supportsLocalFileImagePreview()) {
      const localUrl = toLocalFileUrl(filePath)
      fullImageCacheRef.current.set(filePath, localUrl)
      setImagePreview({ src: thumb ?? localUrl, name: fileName })
      if (thumb) {
        requestAnimationFrame(() => {
          setImagePreview({ src: localUrl, name: fileName })
        })
      }
      return
    }

    if (thumb) {
      setImagePreview({ src: thumb, name: fileName })
    }

    setImagePreviewLoading(true)
    try {
      const src = await getFullImage(filePath)
      if (src) {
        setImagePreview({ src, name: fileName })
      } else if (!thumb) {
        setImagePreview(null)
        toast.showError(t('settings.attachment_preview_failed', '无法加载图片预览'))
      }
    } finally {
      setImagePreviewLoading(false)
    }
  }

  // 并行加载当前页缩略图（限制并发，避免首次进入卡顿）
  React.useEffect(() => {
    if (activePane !== 'diary') return

    const pending = pagedDiaryAttachments.filter(
      (item) => isImageFile(item.name) && !thumbnailCache.has(item.path)
    )
    if (pending.length === 0) return

    let cancelled = false
    let cursor = 0

    const worker = async () => {
      while (!cancelled) {
        const index = cursor++
        if (index >= pending.length) return
        await getThumbnail(pending[index]!.path)
      }
    }

    void Promise.all(
      Array.from({ length: Math.min(THUMBNAIL_LOAD_CONCURRENCY, pending.length) }, () => worker())
    )

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 分页切换时拉取缺失缩略图即可
  }, [activePane, pagedDiaryAttachments])

  // ======= 日记附件事件处理 =======
  const handleDeleteDiarySingle = async (filePath: string) => {
    if (!onDeleteDiaryAttachment) return

    // 找出该附件是否为已引用附件
    const targetItem = diaryAttachments.find((item) => item.path === filePath)
    const isOrphan = targetItem ? targetItem.isOrphan : true

    if (!isOrphan) {
      // 这是一个已引用的附件，需要用户手动输入“确定”来进行二次确认
      const userInput = await dialog.prompt(
        t(
          'settings.attachment_delete_referenced_prompt',
          '该附件已被日记引用，删除可能导致日记内容中链接失效。\n请输入“确定”以确认删除：'
        ),
        '',
        t('settings.attachment_delete_referenced_title', '警告：正在删除已引用的附件')
      )
      if (userInput !== confirmKeyword) {
        toast.showError(t('settings.attachment_delete_mismatch', '输入内容不符，已取消删除'))
        return
      }
    } else {
      // 孤立残留附件直接 confirm
      const confirmed = await dialog.confirm(
        t('settings.attachment_delete_file_confirm', '确定要删除该文件吗？此操作不可撤销。')
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
    } catch (e: any) {
      toast.showError(`${t('common.error', '错误')}: ${e.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteDiarySelected = async () => {
    if (!onDeleteDiaryAttachment || selectedDiaryPaths.size === 0) return

    // 检测所选的文件中是否含有“已被引用的附件”
    const hasReferenced = Array.from(selectedDiaryPaths).some((p) => {
      const item = diaryAttachments.find((item) => item.path === p)
      return item ? !item.isOrphan : false
    })

    if (hasReferenced) {
      // 包含了已引用的附件，必须输入“确定”确认
      const userInput = await dialog.prompt(
        t(
          'settings.attachment_delete_referenced_batch_prompt',
          '选中的附件中包含已被日记引用的文件，删除可能导致链接失效。\n请输入“确定”以确认批量删除选中的 $count 个文件：'
        ).replace('$count', selectedDiaryPaths.size.toString()),
        '',
        t('settings.attachment_delete_referenced_title', '警告：正在删除已引用的附件')
      )
      if (userInput !== confirmKeyword) {
        toast.showError(t('settings.attachment_delete_mismatch', '输入内容不符，已取消删除'))
        return
      }
    } else {
      // 全是孤立附件，直接 confirm
      const confirmed = await dialog.confirm(
        t(
          'settings.attachment_delete_selected_confirm',
          '确定要删除选中的 $count 个文件吗？此操作不可撤销。'
        ).replace('$count', selectedDiaryPaths.size.toString())
      )
      if (!confirmed) return
    }

    const freedSizeMB = Array.from(selectedDiaryPaths).reduce((sum, filePath) => {
      const item = diaryAttachments.find((entry) => entry.path === filePath)
      return sum + (item?.sizeMB ?? 0)
    }, 0)

    setIsDeleting(true)
    try {
      await Promise.all(Array.from(selectedDiaryPaths).map((p) => onDeleteDiaryAttachment(p)))
      toast.showSuccess(formatAttachmentClearCompletedMessage(t, freedSizeMB))
      setSelectedDiaryPaths(new Set())
    } catch (e: any) {
      toast.showError(`${t('common.error', '错误')}: ${e.message}`)
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
    setSelectedDiaryPaths,
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
    getThumbnail,
    handleOpenImagePreview,
    handleDeleteDiarySingle,
    handleDeleteDiarySelected,
    toggleSelectDiary,
    toggleSelectAllDiary,
    isDeleting
  }
}
