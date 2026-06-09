import React from 'react'
import type { MockChatAttachment } from '@baishou/shared'
import { resolveAttachmentAbsolutePath, resolveAttachmentImageSrc } from '@baishou/shared'
import styles from './ContextChainPanel.module.css'

interface ContextChainAttachmentsProps {
  attachments: MockChatAttachment[]
  compact?: boolean
}

async function openLocalAttachment(filePath?: string): Promise<void> {
  const absolutePath = resolveAttachmentAbsolutePath(filePath)
  if (!absolutePath) return

  const w = window as Window & {
    api?: { attachment?: { openFile?: (p: string) => Promise<unknown> } }
  }
  if (w.api?.attachment?.openFile) {
    await w.api.attachment.openFile(absolutePath)
  }
}

export const ContextChainAttachments: React.FC<ContextChainAttachmentsProps> = ({
  attachments,
  compact = false
}) => {
  if (!attachments.length) return null

  return (
    <div className={`${styles.chainAttachments} ${compact ? styles.chainAttachmentsCompact : ''}`}>
      {attachments.map((att) => {
        const src = resolveAttachmentImageSrc(att.filePath)

        if (att.isImage) {
          return (
            <button
              key={att.id}
              type="button"
              className={styles.chainAttImageBtn}
              title={att.fileName}
              onClick={() => void openLocalAttachment(att.filePath)}
            >
              <img src={src} className={styles.chainAttImage} alt={att.fileName} />
            </button>
          )
        }

        return (
          <button
            key={att.id}
            type="button"
            className={styles.chainAttDocBtn}
            title={att.fileName}
            onClick={() => void openLocalAttachment(att.filePath)}
          >
            <span className={styles.chainAttDocIcon}>{att.isPdf || att.isText ? '📄' : '📁'}</span>
            <span className={styles.chainAttDocName}>{att.fileName}</span>
          </button>
        )
      })}
    </div>
  )
}
