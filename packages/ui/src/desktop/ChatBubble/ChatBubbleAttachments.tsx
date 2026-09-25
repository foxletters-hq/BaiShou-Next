import React from 'react'
import { formatFileMentionLabel, type MockChatAttachment } from '@baishou/shared'
import { ChatAttachmentImage, type ChatAttachmentDisplay } from './ChatAttachmentImage'
import styles from './ChatBubble.module.css'

export type ChatAttachmentPlacement = 'before' | 'after'

interface ChatBubbleAttachmentsProps {
  attachments: MockChatAttachment[]
  display?: ChatAttachmentDisplay
  placement?: ChatAttachmentPlacement
}

export const ChatBubbleAttachments: React.FC<ChatBubbleAttachmentsProps> = ({
  attachments,
  display = 'thumb',
  placement = 'before'
}) => {
  if (!attachments.length) return null

  return (
    <div
      className={
        placement === 'after'
          ? `${styles.attachmentsWrap} ${styles.attachmentsWrapAfter}`
          : styles.attachmentsWrap
      }
    >
      {attachments.map((att) => (
        <div key={att.id} className={styles.attachmentItem}>
          {att.isImage ? (
            <ChatAttachmentImage
              filePath={att.filePath}
              fileName={att.fileName}
              display={display}
            />
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
