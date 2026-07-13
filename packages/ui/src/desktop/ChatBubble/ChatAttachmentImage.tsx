import React, { useEffect, useMemo, useState } from 'react'
import { resolveAttachmentAbsolutePath } from '@baishou/shared'
import { ImagePreview } from '../DiaryEditor/ImagePreview'
import { resolveChatAttachmentSrc } from './chat-bubble.utils'
import {
  getChatAttachmentFullImage,
  getChatAttachmentThumbnail
} from './chat-attachment-thumbnail.util'
import styles from './ChatBubble.module.css'

function resolveCopySource(filePath: string): string | undefined {
  if (!filePath) return undefined
  if (filePath.startsWith('blob:') || filePath.startsWith('data:')) return undefined
  if (filePath.startsWith('local://')) {
    return resolveAttachmentAbsolutePath(filePath) || undefined
  }
  if (/^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('/')) {
    return filePath
  }
  const viaChat = resolveChatAttachmentSrc(filePath)
  if (viaChat.startsWith('local://')) {
    return resolveAttachmentAbsolutePath(viaChat) || undefined
  }
  return viaChat || undefined
}

interface ChatAttachmentImageProps {
  filePath: string
  fileName: string
}

export const ChatAttachmentImage: React.FC<ChatAttachmentImageProps> = ({ filePath, fileName }) => {
  const [thumbSrc, setThumbSrc] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewSrc, setPreviewSrc] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)

  const copySource = useMemo(() => resolveCopySource(filePath), [filePath])

  useEffect(() => {
    let cancelled = false
    setThumbSrc(null)

    void getChatAttachmentThumbnail(filePath).then((thumb) => {
      if (!cancelled) {
        setThumbSrc(thumb)
      }
    })

    return () => {
      cancelled = true
    }
  }, [filePath])

  const handleOpenPreview = async () => {
    if (loadingPreview) return
    setLoadingPreview(true)
    try {
      const full = await getChatAttachmentFullImage(filePath)
      setPreviewSrc(full ?? resolveChatAttachmentSrc(filePath))
      setPreviewOpen(true)
    } finally {
      setLoadingPreview(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.attImageButton}
        onClick={() => void handleOpenPreview()}
        aria-label={fileName}
      >
        {thumbSrc ? (
          <img src={thumbSrc} alt={fileName} className={styles.attImage} draggable={false} />
        ) : (
          <div className={styles.attImagePlaceholder} aria-hidden />
        )}
      </button>
      {previewOpen && (
        <ImagePreview
          src={previewSrc}
          copySource={copySource}
          alt={fileName}
          isOpen
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  )
}
