import React from 'react'
import type { MockChatAttachment } from '@baishou/shared'
import styles from './ChatBubble.module.css'

interface ChatBubbleAttachmentsProps {
  attachments: MockChatAttachment[]
  isUserBubble: boolean
}

export const ChatBubbleAttachments: React.FC<ChatBubbleAttachmentsProps> = ({
  attachments,
  isUserBubble
}) => {
  if (!attachments.length) return null

  return (
    <div
      className={`${styles.attachmentsWrap} ${isUserBubble ? styles.alignEnd : styles.alignStart}`}
    >
      {attachments.map((att) => (
        <div key={att.id} className={styles.attachmentItem}>
          {att.isImage ? (
            <img
              src={
                att.filePath?.startsWith('blob:') ||
                att.filePath?.startsWith('local://') ||
                att.filePath?.startsWith('data:')
                  ? att.filePath
                  : `local:///${(att.filePath || '').replace(/\\/g, '/')}`
              }
              className={styles.attImage}
              alt={att.fileName}
            />
          ) : (
            <div className={styles.attDocument}>
              <span className={styles.attDocIcon}>{att.isPdf || att.isText ? '📄' : '📁'}</span>
              <span className={styles.attDocName}>{att.fileName}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
