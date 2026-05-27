import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import type { AttachmentManagementViewProps } from './attachment-management.types'
import { formatSize, isImageFile, getFileIcon } from './attachment-management.utils'
import { useAttachmentSessionState } from './useAttachmentSessionState'
import { useAttachmentDiaryState } from './useAttachmentDiaryState'

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
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const activeYearRef = React.useRef<HTMLButtonElement>(null)
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const [isOrphanPickerOpen, setIsOrphanPickerOpen] = useState(false)
  const monthRef = React.useRef<HTMLDivElement>(null)
  const orphanRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (isYearPickerOpen) {
      setTimeout(() => {
        activeYearRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' })
      }, 80)
    }
  }, [isYearPickerOpen])

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (monthRef.current && !monthRef.current.contains(e.target as Node)) {
        setIsMonthPickerOpen(false)
      }
      if (orphanRef.current && !orphanRef.current.contains(e.target as Node)) {
        setIsOrphanPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
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
    isYearPickerOpen,
    setIsYearPickerOpen,
    mounted,
    activeYearRef,
    isMonthPickerOpen,
    setIsMonthPickerOpen,
    isOrphanPickerOpen,
    setIsOrphanPickerOpen,
    monthRef,
    orphanRef,
    formatSize,
    getFileIcon,
    isImageFile,
    fullImageCacheRef,
    ...session,
    ...diary
  }
}

export type AttachmentManagementViewModel = ReturnType<typeof useAttachmentManagementView>
