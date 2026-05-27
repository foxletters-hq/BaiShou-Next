import { useRef } from 'react'
import type { MockChatAttachment } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'

export function useInputBarAttachments(
  setAttachments: React.Dispatch<React.SetStateAction<MockChatAttachment[]>>
) {
  const { t } = useTranslation()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePickFiles = async () => {
    const api =
      typeof window !== 'undefined'
        ? (window as Window & { api?: { pickFiles?: () => Promise<MockChatAttachment[]> } }).api
        : undefined
    if (api?.pickFiles) {
      try {
        const newAtts = await api.pickFiles()
        if (newAtts?.length) {
          const valid = newAtts.filter((att: MockChatAttachment) => {
            if (att.isText && att.fileSize && att.fileSize > 512 * 1024) {
              toast.showError(t('input.file_too_large', '文件大小超过限制 (最大 512KB)'))
              return false
            }
            return true
          })
          if (valid.length) setAttachments((prev) => [...prev, ...valid])
        }
      } catch (e) {
        console.error('Failed to pick file via IPC:', e)
      }
      return
    }
    fileInputRef.current?.click()
  }

  const handleNativeWebFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    const newAtts = Array.from(e.target.files)
      .map((file) => {
        const isImage = file.type.startsWith('image/')
        const isPdf = file.type === 'application/pdf'
        const isText = file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name)
        return {
          id: Math.random().toString(36).substring(7),
          fileName: file.name,
          filePath: URL.createObjectURL(file),
          isImage,
          isPdf,
          isText,
          fileSize: file.size
        } as MockChatAttachment
      })
      .filter((att) => {
        if (att.isText && att.fileSize && att.fileSize > 512 * 1024) {
          toast.showError(t('input.file_too_large', '文件大小超过限制 (最大 512KB)'))
          return false
        }
        return true
      })
    if (newAtts.length) setAttachments((prev) => [...prev, ...newAtts])
    e.target.value = ''
  }

  return { fileInputRef, handlePickFiles, handleNativeWebFileChange }
}
