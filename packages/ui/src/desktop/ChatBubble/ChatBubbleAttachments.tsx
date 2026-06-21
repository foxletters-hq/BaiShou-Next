import React from 'react'
import type { MockChatAttachment } from '@baishou/shared'
import { ChatAttachmentImage } from './ChatAttachmentImage'
import styles from './ChatBubble.module.css'

interface ChatBubbleAttachmentsProps {
  attachments: MockChatAttachment[]
}

export const ChatBubbleAttachments: React.FC<ChatBubbleAttachmentsProps> = ({ attachments }) => {
  if (!attachments.length) return null

  return (
    <div className={styles.attachmentsWrap}>
      {attachments.map((att) => (
        <div key={att.id} className={styles.attachmentItem}>
          {att.isImage ? (
            <ChatAttachmentImage filePath={att.filePath} fileName={att.fileName} />
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
