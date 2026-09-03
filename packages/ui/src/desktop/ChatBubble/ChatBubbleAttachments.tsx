import React from 'react'
import { formatFileMentionLabel, type MockChatAttachment } from '@baishou/shared'
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
              <div className={styles.attDocMeta}>
                <span className={styles.attDocName}>
                  {att.relativePath
                    ? formatFileMentionLabel({
                        relativePath: att.relativePath,
                        selection: att.selection
                      }).replace(/^@/, '')
                    : att.fileName}
                </span>
                {att.comment?.trim() ? (
                  <span className={styles.attDocComment}>{att.comment.trim()}</span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
