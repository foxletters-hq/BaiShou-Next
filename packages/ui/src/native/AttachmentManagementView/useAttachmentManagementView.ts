import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AttachmentManagementViewProps } from './attachment-management.types'
import { formatSize, defaultToDisplayUri, isImageFile } from './attachment-management.utils'
import { useAttachmentSessionState } from './useAttachmentSessionState'
import { useAttachmentDiaryState } from './useAttachmentDiaryState'

export function useAttachmentManagementView(props: AttachmentManagementViewProps) {
  const {
    attachments,
    onDeleteSelected,
    onDeleteFile,
    onOpenFileLocation,
    diaryAttachments = [],
    onDeleteDiaryAttachment,
    toDisplayUri = defaultToDisplayUri,
    loadImageUri,
    onImageCacheScopeChange
  } = props

  const { t } = useTranslation()
  const confirmKeyword = t('settings.attachment_confirm_keyword', '确定')

  const [activePane, setActivePane] = useState<'session' | 'diary'>('diary')
  const [imagePreview, setImagePreview] = useState<{ src: string; name: string } | null>(null)

  const session = useAttachmentSessionState(attachments, {
    onDeleteSelected,
    onDeleteFile
  })

  const diary = useAttachmentDiaryState(diaryAttachments, activePane, {
    onDeleteDiaryAttachment,
    confirmKeyword,
    toDisplayUri,
    imagePreview,
    setImagePreview
  })

  const handleOpenImagePreview = (filePath: string, fileName: string) => {
    if (!isImageFile(fileName)) return
    void (async () => {
      if (loadImageUri) {
        const src = await loadImageUri(filePath, 'preview')
        if (src) {
          setImagePreview({ src, name: fileName })
        }
        return
      }
      setImagePreview({ src: toDisplayUri(filePath), name: fileName })
    })()
  }

  React.useEffect(() => {
    onImageCacheScopeChange?.()
  }, [
    onImageCacheScopeChange,
    activePane,
    session.currentSessionPage,
    session.sessionPageSize,
    session.activeTab,
    diary.currentDiaryPage,
    diary.diaryPageSize,
    diary.diaryYear,
    diary.diaryMonth,
    diary.diaryOrphanOnly
  ])

  return {
    t,
    confirmKeyword,
    attachments,
    onDeleteSelected,
    onDeleteFile,
    onOpenFileLocation,
    diaryAttachments,
    onDeleteDiaryAttachment,
    activePane,
    setActivePane,
    setImagePreview,
    toDisplayUri,
    loadImageUri,
    formatSize,
    ...session,
    ...diary,
    imagePreview,
    handleOpenImagePreview
  }
}

export type AttachmentManagementViewModel = ReturnType<typeof useAttachmentManagementView>
