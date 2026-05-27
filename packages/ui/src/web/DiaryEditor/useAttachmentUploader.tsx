import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { ContextMenuItem } from '../ContextMenu'
import type { AttachmentUploaderProps, DiaryAttachmentItem } from './attachment-uploader.types'
import { fileToBase64, mapUploadResultToAttachment } from './attachment-uploader.utils'
import { CopyIcon, DeleteIcon, FolderIcon, InsertIcon } from './attachment-uploader.icons'

export function useAttachmentUploader({
  date,
  attachments,
  onAttachmentsChange,
  onInsertAttachment
}: AttachmentUploaderProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return

      setIsUploading(true)
      try {
        const attachmentInputs = Array.from(files).map((file) => ({
          fileName: file.name,
          data: undefined as string | undefined,
          mimeType: file.type,
          filePath: (file as File & { path?: string }).path || undefined
        }))

        const needsBase64 = attachmentInputs.some((a) => !a.filePath)
        if (needsBase64) {
          for (let i = 0; i < files.length; i++) {
            const file = files[i]!
            if (!attachmentInputs[i]!.filePath) {
              const base64 = await fileToBase64(file)
              attachmentInputs[i]!.data = base64
            }
          }
        }

        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        const results = await (window as any).api.diary.uploadAttachments({
          date: dateStr,
          attachments: attachmentInputs
        })

        const newAttachments: DiaryAttachmentItem[] = results
          .filter((r: { success: boolean }) => r.success)
          .map((r: { fileName: string; filePath: string; relativePath: string }) =>
            mapUploadResultToAttachment(r)
          )

        onAttachmentsChange([...attachments, ...newAttachments])
      } catch (err) {
        console.error('Failed to upload attachments:', err)
      } finally {
        setIsUploading(false)
      }
    },
    [date, attachments, onAttachmentsChange]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      handleFileSelect(e.dataTransfer.files)
    },
    [handleFileSelect]
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items
      const files: File[] = []

      for (let i = 0; i < items.length; i++) {
        const item = items[i]!
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        const fileList = new DataTransfer()
        files.forEach((f) => fileList.items.add(f))
        handleFileSelect(fileList.files)
      }
    },
    [handleFileSelect]
  )

  const handleDeleteAttachment = useCallback(
    async (attachment: DiaryAttachmentItem) => {
      try {
        await (window as any).api.diary.deleteAttachment(attachment.filePath)
        onAttachmentsChange(attachments.filter((a) => a.id !== attachment.id))
      } catch (err) {
        console.error('Failed to delete attachment:', err)
      }
    },
    [attachments, onAttachmentsChange]
  )

  const handleOpenFolder = useCallback(async (attachment: DiaryAttachmentItem) => {
    try {
      await (window as any).api.diary.openAttachmentFolder(attachment.filePath)
    } catch (err) {
      console.error('Failed to open folder:', err)
    }
  }, [])

  const handleCopyAttachment = useCallback(async (attachment: DiaryAttachmentItem) => {
    try {
      await (window as any).api.diary.copyAttachment(attachment.filePath)
    } catch (err) {
      console.error('Failed to copy attachment:', err)
    }
  }, [])

  const getContextMenuItems = useCallback(
    (attachment: DiaryAttachmentItem): ContextMenuItem[] => [
      {
        label: t('diary.attachment.insert', '插入到编辑器'),
        icon: <InsertIcon />,
        onClick: () => onInsertAttachment(attachment)
      },
      {
        label: t('diary.attachment.copy', '复制'),
        icon: <CopyIcon />,
        onClick: () => handleCopyAttachment(attachment)
      },
      {
        label: t('diary.attachment.open_folder', '打开文件夹'),
        icon: <FolderIcon />,
        onClick: () => handleOpenFolder(attachment)
      },
      { divider: true, label: '', onClick: () => {} },
      {
        label: t('diary.attachment.delete', '删除'),
        icon: <DeleteIcon />,
        onClick: () => handleDeleteAttachment(attachment)
      }
    ],
    [t, onInsertAttachment, handleCopyAttachment, handleOpenFolder, handleDeleteAttachment]
  )

  return {
    t,
    fileInputRef,
    isDragging,
    isUploading,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
    handleDeleteAttachment,
    handleOpenFolder,
    handleCopyAttachment,
    getContextMenuItems,
    onInsertAttachment
  }
}
