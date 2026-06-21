import { useCallback, useRef } from 'react'
import type { MockChatAttachment } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'
import {
  collectClipboardImageFiles,
  fileToChatAttachment,
  type InputBarAttachment
} from './input-bar-attachment.util'

const TEXT_FILE_SIZE_LIMIT = 512 * 1024

function filterValidAttachments(
  attachments: InputBarAttachment[],
  onReject: (message: string) => void
): InputBarAttachment[] {
  return attachments.filter((att) => {
    if (att.isText && att.fileSize && att.fileSize > TEXT_FILE_SIZE_LIMIT) {
      onReject('input.file_too_large')
      return false
    }
    return true
  })
}

export function useInputBarAttachments(
  setAttachments: React.Dispatch<React.SetStateAction<MockChatAttachment[]>>
) {
  const { t } = useTranslation()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const rejectOversizedText = useCallback(
    (key: string) => {
      toast.showError(t(key, '文件大小超过限制 (最大 512KB)'))
    },
    [t, toast]
  )

  const addAttachments = useCallback(
    async (files: File[]) => {
      if (!files.length) return
      try {
        const newAtts = await Promise.all(files.map(fileToChatAttachment))
        const valid = filterValidAttachments(newAtts, rejectOversizedText)
        if (valid.length) setAttachments((prev) => [...prev, ...valid])
      } catch (e) {
        console.error('Failed to add attachments:', e)
      }
    },
    [rejectOversizedText, setAttachments]
  )

  const handlePickFiles = async () => {
    const api =
      typeof window !== 'undefined'
        ? (window as Window & { api?: { pickFiles?: () => Promise<MockChatAttachment[]> } }).api
        : undefined
    if (api?.pickFiles) {
      try {
        const newAtts = await api.pickFiles()
        if (newAtts?.length) {
          const valid = filterValidAttachments(newAtts as InputBarAttachment[], rejectOversizedText)
          if (valid.length) setAttachments((prev) => [...prev, ...valid])
        }
      } catch (e) {
        console.error('Failed to pick file via IPC:', e)
      }
      return
    }
    fileInputRef.current?.click()
  }

  const handleNativeWebFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    await addAttachments(Array.from(e.target.files))
    e.target.value = ''
  }

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const imageFiles = collectClipboardImageFiles(e.clipboardData)
      if (!imageFiles.length) return

      e.preventDefault()
      await addAttachments(imageFiles)
    },
    [addAttachments]
  )

  return { fileInputRef, handlePickFiles, handleNativeWebFileChange, handlePaste }
}
