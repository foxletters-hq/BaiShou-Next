import React from 'react'
import type { MockChatMessage } from '@baishou/shared'
import { MessageActionBar } from '../MessageActionBar'
import { ChatBubbleAttachments } from './ChatBubbleAttachments'
import { ChatBubbleInlineEditor } from './ChatBubbleInlineEditor'
import { formatRelativeTime } from './chat-bubble.utils'
import styles from './ChatBubble.module.css'
import { resolveWebUserAvatarSrc } from '../user-avatar.util'

interface ChatBubbleUserRowProps {
  message: MockChatMessage
  userProfile: { nickname: string; avatarPath?: string | null }
  isEditing: boolean
  editedContent: string
  setEditedContent: (v: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onEditorKeyDown: (e: React.KeyboardEvent) => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onResendEdit?: () => void
  hasResendEdit: boolean
  onCopy: (e?: React.MouseEvent) => void
  onStartEdit: () => void
  onResend?: () => void
  onDelete?: () => void
  onShowContext?: (msg: MockChatMessage) => void
  t: (key: string, fallback: string) => string
}

export const ChatBubbleUserRow: React.FC<ChatBubbleUserRowProps> = ({
  message,
  userProfile,
  isEditing,
  editedContent,
  setEditedContent,
  textareaRef,
  onEditorKeyDown,
  onCancelEdit,
  onSaveEdit,
  onResendEdit,
  hasResendEdit,
  onCopy,
  onStartEdit,
  onResend,
  onDelete,
  onShowContext,
  t
}) => (
  <div className={`${styles.bubbleRow} ${styles.userRow}`}>
    <div className={styles.messageCol}>
      <div className={`${styles.nameTimeRow} ${styles.justifyEnd}`}>
        <span className={styles.nameLabel}>{userProfile.nickname}</span>
        <span className={styles.timeLabel} title={message.timestamp.toLocaleString()}>
          {formatRelativeTime(message.timestamp, t)}
        </span>
      </div>

      {isEditing ? (
        <div
          className={`${styles.userBubbleCard} ${styles.editingBubbleCard}`}
        >
          <ChatBubbleInlineEditor
            isUser
            editedContent={editedContent}
            onChange={setEditedContent}
            onKeyDown={onEditorKeyDown}
            onCancel={onCancelEdit}
            onSave={onSaveEdit}
            onResend={hasResendEdit ? onResendEdit : undefined}
            textareaRef={textareaRef}
          />
        </div>
      ) : (
        <>
          <div className={styles.userBubbleCard}>
            {message.attachments && message.attachments.length > 0 && (
              <ChatBubbleAttachments attachments={message.attachments} />
            )}
            {message.content && <div className={styles.textContentUser}>{message.content}</div>}
          </div>
          <div className={styles.userFooterRow}>
            <MessageActionBar
              isAI={false}
              onCopy={onCopy}
              onRetry={onResend}
              onEdit={onStartEdit}
              onDelete={onDelete}
              onShowContext={onShowContext ? () => onShowContext(message) : undefined}
            />
          </div>
        </>
      )}
    </div>

    <div className={styles.avatarWrap}>
      <img
        src={resolveWebUserAvatarSrc(userProfile.avatarPath)}
        alt="avatar"
        className={styles.avatarImg}
      />
    </div>
  </div>
)
