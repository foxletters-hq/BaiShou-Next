import React, { useState, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import type { ChatBubbleProps } from './chat-bubble.types'
import { useChatBubbleEdit } from './useChatBubbleEdit'
import { ChatBubbleUserRow } from './ChatBubbleUserRow'
import { ChatBubbleAiRow } from './ChatBubbleAiRow'
import { ChatBubbleContextMenu } from './ChatBubbleContextMenu'
import styles from './ChatBubble.module.css'

function areDesktopChatBubblePropsEqual(prev: ChatBubbleProps, next: ChatBubbleProps): boolean {
  if (prev.isTtsPlaying !== next.isTtsPlaying) return false
  if (prev.error !== next.error) return false
  if (
    prev.userProfile?.nickname !== next.userProfile?.nickname ||
    prev.userProfile?.avatarPath !== next.userProfile?.avatarPath
  ) {
    return false
  }
  if (
    prev.aiProfile?.name !== next.aiProfile?.name ||
    prev.aiProfile?.avatarPath !== next.aiProfile?.avatarPath ||
    prev.aiProfile?.emoji !== next.aiProfile?.emoji
  ) {
    return false
  }
  if (
    Boolean(prev.onRegenerate) !== Boolean(next.onRegenerate) ||
    Boolean(prev.onResend) !== Boolean(next.onResend) ||
    Boolean(prev.onSaveEdit) !== Boolean(next.onSaveEdit) ||
    Boolean(prev.onResendEdit) !== Boolean(next.onResendEdit) ||
    Boolean(prev.onBranch) !== Boolean(next.onBranch) ||
    Boolean(prev.onShowContext) !== Boolean(next.onShowContext) ||
    Boolean(prev.onReadAloud) !== Boolean(next.onReadAloud)
  ) {
    return false
  }

  if (prev.message === next.message) return true

  return (
    prev.message.id === next.message.id &&
    prev.message.role === next.message.role &&
    prev.message.content === next.message.content &&
    prev.message.reasoning === next.message.reasoning &&
    prev.message.isReasoning === next.message.isReasoning &&
    prev.message.inputTokens === next.message.inputTokens &&
    prev.message.outputTokens === next.message.outputTokens &&
    prev.message.cacheReadInputTokens === next.message.cacheReadInputTokens &&
    prev.message.cacheWriteInputTokens === next.message.cacheWriteInputTokens &&
    prev.message.costMicros === next.message.costMicros &&
    (prev.message.parts === next.message.parts ||
      (prev.message.parts?.length ?? 0) === (next.message.parts?.length ?? 0)) &&
    (prev.message.toolInvocations === next.message.toolInvocations ||
      (prev.message.toolInvocations?.length ?? 0) === (next.message.toolInvocations?.length ?? 0)) &&
    (prev.message.attachments === next.message.attachments ||
      (prev.message.attachments?.length ?? 0) === (next.message.attachments?.length ?? 0)) &&
    (prev.message.skillRefs === next.message.skillRefs ||
      (prev.message.skillRefs?.length ?? 0) === (next.message.skillRefs?.length ?? 0))
  )
}

export const ChatBubble: React.FC<ChatBubbleProps> = React.memo(
  ({
    message,
    userProfile = { nickname: 'U' },
    aiProfile = { name: 'AI' },
    onRegenerate,
    onResend,
    onCopy,
    onDelete,
    onBranch,
    onSaveEdit,
    onResendEdit,
    onShowContext,
    onReadAloud,
    isTtsPlaying = false,
    error = null
  }) => {
    const { t } = useTranslation()
    const toast = useToast()
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
    const selectedTextRef = useRef('')
    const isUser = message.role === 'user'
    const edit = useChatBubbleEdit(message.content || '', isUser, onSaveEdit, onResendEdit)

    const { cleanContent, cleanReasoning } = useMemo(
      () => parseRedactedThinking(message.content || '', message.reasoning || ''),
      [message.content, message.reasoning]
    )

    const handleContextMenu = (e: React.MouseEvent) => {
      if (edit.isEditing) return
      e.preventDefault()
      const selection = window.getSelection()
      selectedTextRef.current = selection ? selection.toString().trim() : ''
      setContextMenu({ x: e.clientX, y: e.clientY })
    }

    const handleCopy = useCallback(
      (e?: React.MouseEvent) => {
        if (e) e.preventDefault()
        const selectedText = selectedTextRef.current
        if (selectedText) {
          navigator.clipboard.writeText(selectedText)
          toast.showSuccess(t('common.copied', '已复制到剪贴板'))
        } else if (onCopy) {
          onCopy()
        } else if (message.content) {
          navigator.clipboard.writeText(message.content)
          toast.showSuccess(t('common.copied', '已复制到剪贴板'))
        }
        setContextMenu(null)
      },
      [onCopy, message.content, t, toast]
    )

    // 工具消息不渲染气泡。这个提前返回必须留在所有 Hook 调用之后，否则 message.role 变化时 Hook 顺序会错位
    if (message.role === 'tool') {
      return null
    }

    const aiName = aiProfile.name || t('agent.chat.ai_label', 'AI')
    const canEdit = Boolean(onSaveEdit || onResendEdit)
    const startEdit = canEdit ? edit.handleStartEdit : undefined

    return (
      <>
        <div
          className={`chat-bubble-container ${styles.chatBubbleContainer}`}
          onContextMenu={handleContextMenu}
        >
          {isUser ? (
            <ChatBubbleUserRow
              message={message}
              userProfile={userProfile}
              isEditing={edit.isEditing}
              editedContent={edit.editedContent}
              setEditedContent={edit.setEditedContent}
              textareaRef={edit.textareaRef}
              onEditorKeyDown={edit.handleEditorKeyDown}
              onCancelEdit={edit.handleCancelEdit}
              onSaveEdit={edit.handleSaveEdit}
              onResendEdit={edit.handleResendEdit}
              hasResendEdit={Boolean(onResendEdit)}
              onCopy={handleCopy}
              onStartEdit={startEdit}
              onResend={onResend}
              onDelete={onDelete}
              onShowContext={onShowContext}
              t={t}
            />
          ) : (
            <ChatBubbleAiRow
              message={message}
              aiProfile={aiProfile}
              aiName={aiName}
              cleanContent={cleanContent}
              cleanReasoning={cleanReasoning}
              isEditing={edit.isEditing}
              editedContent={edit.editedContent}
              setEditedContent={edit.setEditedContent}
              textareaRef={edit.textareaRef}
              onEditorKeyDown={edit.handleEditorKeyDown}
              onCancelEdit={edit.handleCancelEdit}
              onSaveEdit={edit.handleSaveEdit}
              onCopy={handleCopy}
              onStartEdit={startEdit}
              onRegenerate={onRegenerate}
              onDelete={onDelete}
              onBranch={onBranch}
              onShowContext={onShowContext}
              onReadAloud={onReadAloud}
              isTtsPlaying={isTtsPlaying}
              error={error}
              t={t}
            />
          )}
        </div>
        <ChatBubbleContextMenu
          contextMenu={contextMenu}
          isUser={isUser}
          onDismiss={() => setContextMenu(null)}
          onCopy={handleCopy}
          onStartEdit={startEdit}
          onResend={onResend}
          onRegenerate={onRegenerate}
          onDelete={onDelete}
        />
      </>
    )
  },
  areDesktopChatBubblePropsEqual
)
