import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import type { AttachmentManagementViewProps } from './attachment-management.types'
import { formatSize, isImageFile, getFileIcon } from './attachment-management.utils'
import { useAttachmentSessionState } from './useAttachmentSessionState'
import { useAttachmentDiaryState } from './useAttachmentDiaryState'

export type AttachmentFilterPicker = 'year' | 'month' | 'orphan' | null

export function useAttachmentManagementView(props: AttachmentManagementViewProps) {
  const {
    attachments,
    onDeleteSelected,
    onDeleteFile,
    onOpenFileLocation,
    diaryAttachments = [],
    onDeleteDiaryAttachment
  } = props

  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const confirmKeyword = t('settings.attachment_confirm_keyword', '确定')

  const [activePane, setActivePane] = useState<'session' | 'diary'>('diary')
  const [thumbnailCache, setThumbnailCache] = useState<Map<string, string>>(new Map())
  const thumbnailLoadingRef = React.useRef<Set<string>>(new Set())
  const [imagePreview, setImagePreview] = useState<{ src: string; name: string } | null>(null)
  const [imagePreviewLoading, setImagePreviewLoading] = useState(false)
  const fullImageCacheRef = React.useRef<Map<string, string>>(new Map())
  const [openFilterPicker, setOpenFilterPicker] = useState<AttachmentFilterPicker>(null)
  const [mounted, setMounted] = useState(false)
  const yearRef = React.useRef<HTMLDivElement>(null)
  const monthRef = React.useRef<HTMLDivElement>(null)
  const orphanRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!openFilterPicker) return
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node
      const insideYear = yearRef.current?.contains(target)
      const insideMonth = monthRef.current?.contains(target)
      const insideOrphan = orphanRef.current?.contains(target)
      if (!insideYear && !insideMonth && !insideOrphan) {
        setOpenFilterPicker(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [openFilterPicker])

  const toggleFilterPicker = React.useCallback((picker: Exclude<AttachmentFilterPicker, null>) => {
    setOpenFilterPicker((prev) => (prev === picker ? null : picker))
  }, [])

  const session = useAttachmentSessionState(attachments, {
    onDeleteSelected,
    onDeleteFile
  })
  const diary = useAttachmentDiaryState(
    diaryAttachments,
    activePane,
    thumbnailCache,
    setThumbnailCache,
    thumbnailLoadingRef,
    {
      onDeleteDiaryAttachment,
      confirmKeyword,
      imagePreview,
      setImagePreview,
      imagePreviewLoading,
      setImagePreviewLoading,
      fullImageCacheRef
    }
  )

  const {
    diaryYear,
    diaryMonth,
    diaryOrphanOnly,
    setDiaryYear,
    setDiaryMonth,
    setDiaryOrphanOnly
  } = diary

  const hasActiveDiaryFilters = diaryYear !== 'all' || diaryMonth !== 'all' || diaryOrphanOnly

  const clearDiaryFilters = React.useCallback(() => {
    setDiaryYear('all')
    setDiaryMonth('all')
    setDiaryOrphanOnly(false)
    setOpenFilterPicker(null)
  }, [setDiaryYear, setDiaryMonth, setDiaryOrphanOnly])

  const { getThumbnail } = diary
  const { pagedSessionList, expandedIds } = session

  // 会话附件：预加载封面图 + 已展开分组内的图片缩略图
  React.useEffect(() => {
    if (activePane !== 'session') return

    const pendingPaths: string[] = []
    const seen = new Set<string>()

    for (const group of pagedSessionList) {
      const files = Array.isArray(group.files) ? group.files : []
      const cover = files.find((file) => isImageFile(file.name))
      if (cover && !thumbnailCache.has(cover.path) && !seen.has(cover.path)) {
        pendingPaths.push(cover.path)
        seen.add(cover.path)
      }
      if (!expandedIds.has(group.sessionId)) continue
      for (const file of files) {
        if (isImageFile(file.name) && !thumbnailCache.has(file.path) && !seen.has(file.path)) {
          pendingPaths.push(file.path)
          seen.add(file.path)
        }
      }
    }

    if (pendingPaths.length === 0) return

    let cancelled = false
    let cursor = 0
    const concurrency = Math.min(4, pendingPaths.length)

    const worker = async () => {
      while (!cancelled) {
        const index = cursor++
        if (index >= pendingPaths.length) return
        await getThumbnail(pendingPaths[index]!)
      }
    }

    void Promise.all(Array.from({ length: concurrency }, () => worker()))

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在页/展开变化时补齐缺失缩略图
  }, [activePane, pagedSessionList, expandedIds])

  return {
    t,
    dialog,
    toast,
    confirmKeyword,
    attachments,
    onDeleteSelected,
    onDeleteFile,
    onOpenFileLocation,
    diaryAttachments,
    onDeleteDiaryAttachment,
    activePane,
    setActivePane,
    thumbnailCache,
    imagePreview,
    setImagePreview,
    imagePreviewLoading,
    openFilterPicker,
    setOpenFilterPicker,
    toggleFilterPicker,
    mounted,
    yearRef,
    monthRef,
    orphanRef,
    hasActiveDiaryFilters,
    clearDiaryFilters,
    formatSize,
    getFileIcon,
    isImageFile,
    fullImageCacheRef,
    ...session,
    ...diary
  }
}

export type AttachmentManagementViewModel = ReturnType<typeof useAttachmentManagementView>
