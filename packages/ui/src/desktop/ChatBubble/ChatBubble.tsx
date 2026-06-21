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

export const ChatBubble: React.FC<ChatBubbleProps> = ({
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
  isTtsPlaying = false
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

  if (message.role === 'tool') {
    return null
  }

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

  const aiName = aiProfile.name || t('agent.chat.ai_label', 'AI')

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
            onStartEdit={edit.handleStartEdit}
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
            onStartEdit={edit.handleStartEdit}
            onRegenerate={onRegenerate}
            onDelete={onDelete}
            onBranch={onBranch}
            onShowContext={onShowContext}
            onReadAloud={onReadAloud}
            isTtsPlaying={isTtsPlaying}
            t={t}
          />
        )}
      </div>
      <ChatBubbleContextMenu
        contextMenu={contextMenu}
        isUser={isUser}
        onDismiss={() => setContextMenu(null)}
        onCopy={handleCopy}
        onStartEdit={edit.handleStartEdit}
        onResend={onResend}
        onRegenerate={onRegenerate}
        onDelete={onDelete}
      />
    </>
  )
}
