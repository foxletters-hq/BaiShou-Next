import React from 'react'
import type { MockChatMessage } from '@baishou/shared'
import { MessageActionBar } from '../MessageActionBar'
import { MarkdownRenderer } from '../MarkdownRenderer'
import { ToolResultGroup } from '../ToolResultGroupCard'
import { ThinkingBlock } from '../ThinkingBlock'
import { ChatBubbleAttachments } from './ChatBubbleAttachments'
import { ChatBubbleInlineEditor } from './ChatBubbleInlineEditor'
import { formatRelativeTime } from './chat-bubble.utils'
import styles from './ChatBubble.module.css'

interface ChatBubbleAiRowProps {
  message: MockChatMessage
  aiProfile: { name: string; avatarPath?: string | null; emoji?: string | null }
  aiName: string
  cleanContent: string
  cleanReasoning: string
  isEditing: boolean
  editedContent: string
  setEditedContent: (v: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onEditorKeyDown: (e: React.KeyboardEvent) => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onCopy: (e?: React.MouseEvent) => void
  onStartEdit: () => void
  onRegenerate?: () => void
  onDelete?: () => void
  onBranch?: () => void
  onShowContext?: (msg: MockChatMessage) => void
  onReadAloud?: (content: string) => void
  isTtsPlaying: boolean
  t: (key: string, fallback: string) => string
}

export const ChatBubbleAiRow: React.FC<ChatBubbleAiRowProps> = ({
  message,
  aiProfile,
  aiName,
  cleanContent,
  cleanReasoning,
  isEditing,
  editedContent,
  setEditedContent,
  textareaRef,
  onEditorKeyDown,
  onCancelEdit,
  onSaveEdit,
  onCopy,
  onStartEdit,
  onRegenerate,
  onDelete,
  onBranch,
  onShowContext,
  onReadAloud,
  isTtsPlaying,
  t
}) => (
  <div className={`${styles.bubbleRow} ${styles.aiRow}`}>
    <div className={styles.avatarWrap}>
      {aiProfile.avatarPath ? (
        <img src={aiProfile.avatarPath} alt="avatar" className={styles.avatarImg} />
      ) : aiProfile.emoji ? (
        <div className={`${styles.avatarFallback} ${styles.aiAvatar}`}>{aiProfile.emoji}</div>
      ) : (
        <div className={`${styles.avatarFallback} ${styles.aiAvatar}`}>✨</div>
      )}
    </div>

    <div className={styles.messageCol}>
      <div className={`${styles.nameTimeRow} ${styles.justifyStart}`}>
        <span className={styles.nameLabel}>{aiName}</span>
        <span className={styles.timeLabel} title={message.timestamp.toLocaleString()}>
          {formatRelativeTime(message.timestamp, t)}
        </span>
      </div>

      {isEditing ? (
        <div className={`${styles.aiBubbleCard} ${styles.editingBubbleCard}`}>
          <ChatBubbleInlineEditor
            isUser={false}
            editedContent={editedContent}
            onChange={setEditedContent}
            onKeyDown={onEditorKeyDown}
            onCancel={onCancelEdit}
            onSave={onSaveEdit}
            textareaRef={textareaRef}
          />
        </div>
      ) : (
        <>
          <div className={styles.aiBubbleCard}>
            {message.attachments && message.attachments.length > 0 && (
              <ChatBubbleAttachments attachments={message.attachments} isUserBubble={false} />
            )}
            {cleanReasoning && (
              <ThinkingBlock
                content={cleanReasoning}
                isThinking={false}
                defaultOpen={false}
                autoCollapse
              />
            )}
            {message.toolInvocations && message.toolInvocations.length > 0 && (
              <ToolResultGroup invocations={message.toolInvocations} />
            )}
            {cleanContent && <MarkdownRenderer content={cleanContent} />}
          </div>

          <div className={styles.aiFooterRow}>
            <MessageActionBar
              isAI
              onCopy={onCopy}
              onRetry={onRegenerate}
              onEdit={onStartEdit}
              onDelete={onDelete}
              onBranch={onBranch}
              onReadAloud={onReadAloud ? () => onReadAloud(message.content || '') : undefined}
              isTtsPlaying={isTtsPlaying}
              onShowContext={onShowContext ? () => onShowContext(message) : undefined}
            />
          </div>
        </>
      )}
    </div>
  </div>
)
