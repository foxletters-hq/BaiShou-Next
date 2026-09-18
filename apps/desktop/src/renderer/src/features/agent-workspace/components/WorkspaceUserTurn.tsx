import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatBubbleAttachments, MessageActionBar, UserMessageSkillContent } from '@baishou/ui'
import type { PromptFileRef } from '@baishou/shared'
import type { WorkspaceChatMessage } from '../hooks/useWorkspaceChatMessages'
import {
  getWorkspaceBubbleAttachments,
  getWorkspaceUserFileRefs,
  getWorkspaceUserSkillRefs,
  getWorkspaceUserText
} from '../utils/workspace-message-display.util'
import { copyWorkspaceBubbleText } from '../utils/workspace-copy-text.util'
import { shouldStartWorkspaceBubbleEdit } from '../utils/workspace-rollback-hover.util'
import type { WorkspaceBubbleActions } from './workspace-bubble-actions.types'
import styles from './AgentWorkspaceMessageList.module.css'

export function WorkspaceUserTurn(props: {
  msg: WorkspaceChatMessage
  dimmed?: boolean
  editingActive: boolean
  onEditingChange: (messageId: string | null) => void
  onEditResend?: (
    userMessageId: string,
    newText: string,
    meta?: {
      skillRefs?: Array<{ command: string; content: string }>
      fileRefs?: PromptFileRef[]
    }
  ) => boolean | Promise<boolean>
  bubbleActions?: WorkspaceBubbleActions
  onOpenFile?: (relativePath: string, options?: { line?: number; isDirectory?: boolean }) => void
}) {
  const { t } = useTranslation()
  const { msg, dimmed, editingActive, onEditingChange, onEditResend, bubbleActions, onOpenFile } =
    props
  const userText = getWorkspaceUserText(msg)
  const skillRefs = getWorkspaceUserSkillRefs(msg) ?? msg.skillRefs
  const fileRefs = getWorkspaceUserFileRefs(msg)
  const attachments = getWorkspaceBubbleAttachments(msg)
  const [editedContent, setEditedContent] = useState(userText)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editingActive) {
      setEditedContent(userText)
    }
  }, [editingActive, userText])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!editingActive || !textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(textarea.scrollHeight, 40)}px`
  }, [editingActive, editedContent])

  useEffect(() => {
    if (!editingActive || !textareaRef.current) return
    const textarea = textareaRef.current
    textarea.focus({ preventScroll: true })
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [editingActive])

  const startEdit = () => {
    if (!onEditResend) return
    onEditingChange(msg.id)
  }

  const cancelEdit = () => {
    setEditedContent(userText)
    onEditingChange(null)
  }

  const handleResend = useCallback(async () => {
    const trimmed = editedContent.trim()
    if (!trimmed || !onEditResend) return
    const applied = await onEditResend(msg.id, trimmed, { skillRefs, fileRefs })
    if (applied) {
      onEditingChange(null)
    }
  }, [editedContent, fileRefs, msg.id, onEditResend, onEditingChange, skillRefs])

  const handleBubbleClick = (event: React.MouseEvent) => {
    if (!onEditResend || editingActive) return
    const selection = window.getSelection()
    if (
      !shouldStartWorkspaceBubbleEdit({
        defaultPrevented: event.defaultPrevented,
        target: event.target,
        hasNonCollapsedSelection: Boolean(
          selection && !selection.isCollapsed && selection.toString().trim()
        )
      })
    ) {
      return
    }
    startEdit()
  }

  return (
    <div
      className={`chat-bubble-container ${styles.turn} ${styles.userTurn}${
        dimmed ? ` ${styles.turnDimmed}` : ''
      }${editingActive ? ` ${styles.turnEditing}` : ''}`}
    >
      {editingActive ? (
        <div className={styles.userEditWrap}>
          <textarea
            ref={textareaRef}
            className={styles.userEditArea}
            value={editedContent}
            onChange={(event) => setEditedContent(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                cancelEdit()
                return
              }
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()
                void handleResend()
              }
            }}
            rows={1}
            aria-label={t('workbench.click_to_edit_message', '点击编辑这条消息')}
          />
          <div className={styles.userEditActions}>
            <button type="button" className={styles.userEditCancel} onClick={cancelEdit}>
              {t('common.cancel', '取消')}
            </button>
            <button
              type="button"
              className={styles.userEditSend}
              onClick={() => {
                void handleResend()
              }}
            >
              {t('workbench.send_edited_message', '发送')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className={`${styles.userAnchor}${onEditResend ? ` ${styles.userAnchorEditable}` : ''}`}
            title={
              onEditResend ? t('workbench.click_to_edit_message', '点击编辑这条消息') : undefined
            }
            onClick={handleBubbleClick}
          >
            {attachments.length > 0 ? <ChatBubbleAttachments attachments={attachments} /> : null}
            {userText || skillRefs?.length || fileRefs.length ? (
              <UserMessageSkillContent
                text={userText}
                skillRefs={skillRefs}
                fileRefs={fileRefs}
                onOpenFile={onOpenFile}
              />
            ) : null}
          </div>
          <div className={styles.turnActions}>
            <MessageActionBar
              isAI={false}
              onCopy={() => copyWorkspaceBubbleText(userText)}
              onEdit={onEditResend ? startEdit : undefined}
              onRetry={bubbleActions?.onResend ? () => bubbleActions.onResend?.(msg.id) : undefined}
              onDelete={
                bubbleActions?.onDelete ? () => bubbleActions.onDelete?.(msg.id) : undefined
              }
              onShowContext={
                bubbleActions?.onShowContext ? () => bubbleActions.onShowContext?.(msg) : undefined
              }
            />
          </div>
        </>
      )}
    </div>
  )
}
