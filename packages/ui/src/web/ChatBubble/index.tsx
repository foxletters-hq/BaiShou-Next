import React, { useState, useRef, useCallback, useEffect, useMemo, useLayoutEffect } from 'react'
import styles from './ChatBubble.module.css'
import { MarkdownRenderer } from '../MarkdownRenderer'
import { MessageActionBar } from '../MessageActionBar'
import { ToolResultGroup } from '../ToolResultGroupCard'
import { ThinkingBlock } from '../ThinkingBlock'
import { MockChatMessage, MockChatAttachment } from '@baishou/shared/src/mock/agent.mock'

import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'

export interface ChatBubbleProps {
  message: MockChatMessage
  userProfile?: { nickname: string; avatarPath?: string | null }
  aiProfile?: {
    name: string
    avatarPath?: string | null
    emoji?: string | null
  }
  onEdit?: () => void
  onRegenerate?: () => void
  onResend?: () => void
  onCopy?: () => void
  onDelete?: () => void
  onBranch?: () => void
  onSaveEdit?: (newContent: string) => void
  onResendEdit?: (newContent: string) => void
  onShowContext?: (msg: MockChatMessage) => void
  onReadAloud?: (content: string) => void
  isTtsPlaying?: boolean
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  userProfile = { nickname: 'U' },
  aiProfile = { name: 'AI' },
  onEdit,
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
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
  } | null>(null)
  const selectedTextRef = useRef<string>('')
  const chatMenuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (contextMenu && chatMenuRef.current) {
      const rect = chatMenuRef.current.getBoundingClientRect()
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      let adjustedX = contextMenu.x
      let adjustedY = contextMenu.y

      if (contextMenu.x + rect.width > windowWidth) {
        adjustedX = Math.max(10, windowWidth - rect.width - 10)
      }
      if (contextMenu.y + rect.height > windowHeight) {
        adjustedY = Math.max(10, windowHeight - rect.height - 10)
      }

      chatMenuRef.current.style.left = `${adjustedX}px`
      chatMenuRef.current.style.top = `${adjustedY}px`
    }
  }, [contextMenu])
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  if (message.role === 'tool') {
    return null
  }

  const isUser = message.role === 'user'

  // 自动聚焦并定位到末尾
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const ta = textareaRef.current
      ta.focus()
      ta.setSelectionRange(ta.value.length, ta.value.length)
      ta.scrollTop = ta.scrollHeight
    }
  }, [isEditing])

  const handleStartEdit = useCallback(() => {
    setEditedContent(message.content || '')
    setIsEditing(true)
  }, [message.content])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditedContent('')
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (onSaveEdit) {
      onSaveEdit(editedContent)
    }
    setIsEditing(false)
  }, [onSaveEdit, editedContent])

  const handleResendEdit = useCallback(() => {
    if (onResendEdit) {
      onResendEdit(editedContent)
    }
    setIsEditing(false)
  }, [onResendEdit, editedContent])

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelEdit()
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (isUser && onResendEdit) {
          handleResendEdit()
        } else {
          handleSaveEdit()
        }
      }
    },
    [handleCancelEdit, handleSaveEdit, handleResendEdit, isUser, onResendEdit]
  )

  const formatTime = (date: Date) => {
    const diff = (new Date().getTime() - date.getTime()) / 1000
    if (diff < 60) return t('common.just_now', '刚刚')
    if (diff < 3600) return `${Math.floor(diff / 60)} ${t('common.minutes_ago', '分钟前')}`
    if (diff < 86400) return `${Math.floor(diff / 3600)} ${t('common.hours_ago', '小时前')}`
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isEditing) return // 编辑状态下不弹右键菜单
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

  const renderAttachments = (isUserBubble: boolean) => {
    if (!message.attachments || message.attachments.length === 0) return null
    return (
      <div
        className={`${styles.attachmentsWrap} ${isUserBubble ? styles.alignEnd : styles.alignStart}`}
      >
        {message.attachments.map((att: MockChatAttachment) => (
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
                <span className={styles.attDocIcon}>{(att.isPdf || att.isText) ? '📄' : '📁'}</span>
                <span className={styles.attDocName}>{att.fileName}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // 内联编辑器渲染
  const renderEditor = () => (
    <div className={styles.editorContainer}>
      <textarea
        ref={textareaRef}
        className={styles.editorTextarea}
        value={editedContent}
        onChange={(e) => setEditedContent(e.target.value)}
        onKeyDown={handleEditorKeyDown}
        rows={3}
      />
      <div className={styles.editorActions}>
        <button
          className={`${styles.editorBtn} ${styles.editorBtnCancel}`}
          onClick={handleCancelEdit}
        >
          {t('common.cancel', '取消')}
        </button>
        {!isUser && (
          <button
            className={`${styles.editorBtn} ${styles.editorBtnSave}`}
            onClick={handleSaveEdit}
          >
            {t('common.save', '保存')}
          </button>
        )}
        {isUser && onResendEdit && (
          <button
            className={`${styles.editorBtn} ${styles.editorBtnResend}`}
            onClick={handleResendEdit}
          >
            {t('common.resend', '重新发送')}
          </button>
        )}
      </div>
    </div>
  )

  const renderUserBubble = () => {
    return (
      <div className={`${styles.bubbleRow} ${styles.userRow}`}>
        <div className={styles.messageCol}>
          <div className={`${styles.nameTimeRow} ${styles.justifyEnd}`}>
            <span className={styles.nameLabel}>{userProfile.nickname}</span>
            <span className={styles.timeLabel} title={message.timestamp.toLocaleString()}>
              {formatTime(message.timestamp)}
            </span>
          </div>

          {isEditing ? (
            <div
              className={`${styles.userBubbleCard} ${styles.editingBubbleCard}`}
              style={{
                background: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}
            >
              {renderEditor()}
            </div>
          ) : (
            <>
              <div className={styles.userBubbleCard}>
                {renderAttachments(true)}
                {message.content && <div className={styles.textContentUser}>{message.content}</div>}
              </div>
              <MessageActionBar
                isAI={false}
                onCopy={handleCopy}
                onRetry={onResend}
                onEdit={handleStartEdit}
                onDelete={onDelete}
              />
            </>
          )}
        </div>

        <div className={styles.avatarWrap}>
          {userProfile.avatarPath ? (
            <img src={userProfile.avatarPath} alt="avatar" className={styles.avatarImg} />
          ) : (
            <div className={`${styles.avatarFallback} ${styles.userAvatar}`}>
              {userProfile.nickname.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderAiBubble = () => {
    const aiName = aiProfile.name || t('agent.chat.ai_label')

    // 零副作用过滤提取 <think> 标签，彻底避免 AI 历史回复夹带人机/思考杂质
    const { cleanContent, cleanReasoning } = useMemo(() => {
      let cleanContent = message.content || ''
      let cleanReasoning = message.reasoning || ''

      // 1. 匹配并提取完整的 <think>...</think>
      const thinkRegex = /<think>([\s\S]*?)<\/think>/gi
      let match
      while ((match = thinkRegex.exec(message.content || '')) !== null) {
        if (match[1]) {
          cleanReasoning += (cleanReasoning ? '\n' : '') + match[1].trim()
        }
      }
      cleanContent = cleanContent.replace(thinkRegex, '')

      // 2. 匹配未闭合的 <think>
      if (cleanContent.includes('<think>')) {
        const parts = cleanContent.split('<think>')
        cleanContent = parts[0] || ''
        const unclosed = parts.slice(1).join('<think>')
        if (unclosed) {
          cleanReasoning += (cleanReasoning ? '\n' : '') + unclosed.trim()
        }
      }

      return {
        cleanContent: cleanContent.trim(),
        cleanReasoning: cleanReasoning.trim()
      }
    }, [message.content, message.reasoning])

    return (
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
              {formatTime(message.timestamp)}
            </span>
          </div>

          {isEditing ? (
            <div className={`${styles.aiBubbleCard} ${styles.editingBubbleCard}`}>{renderEditor()}</div>
          ) : (
            <>
              <div className={styles.aiBubbleCard}>
                {renderAttachments(false)}

                {/* Reasoning 块 - 移到 aiBubbleCard 内部且默认折叠 */}
                {cleanReasoning && (
                  <ThinkingBlock
                    content={cleanReasoning}
                    isThinking={false}
                    defaultOpen={false}
                    autoCollapse={true}
                  />
                )}

                {/* 工具调用 */}
                {message.toolInvocations && message.toolInvocations.length > 0 && (
                  <ToolResultGroup invocations={message.toolInvocations} />
                )}

                {/* 正文内容 */}
                {cleanContent && <MarkdownRenderer content={cleanContent} />}
              </div>

              <div className={styles.aiFooterRow}>
                <MessageActionBar
                  isAI={true}
                  onCopy={handleCopy}
                  onRetry={onRegenerate}
                  onEdit={handleStartEdit}
                  onDelete={onDelete}
                  onBranch={onBranch}
                  onReadAloud={onReadAloud ? () => onReadAloud(message.content || '') : undefined}
                  isTtsPlaying={isTtsPlaying}
                />
                <div className={styles.footerRight}>
                  {message.contextMessages && message.contextMessages.length > 0 && (
                    <button
                      className={styles.contextBtn}
                      onClick={() => onShowContext && onShowContext(message)}
                      title={t('chat.viewContextTree', '查看对话上下文树')}
                    >
                      🌿
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className={`chat-bubble-container ${styles.chatBubbleContainer}`}
        onContextMenu={handleContextMenu}
      >
        {isUser ? renderUserBubble() : renderAiBubble()}
      </div>
      {contextMenu && (
        <div
          className={styles.contextMenuOverlay}
          onMouseDown={(e) => {
            e.preventDefault()
            setContextMenu(null)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu(null)
          }}
        >
          <div
            ref={chatMenuRef}
            className={styles.contextMenu}
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button onMouseDown={handleCopy}>{t('common.copy', '复制')}</button>
            {isUser ? (
              <>
                {onResend && (
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setContextMenu(null)
                      onResend()
                    }}
                  >
                    {t('common.retry', '重新发送')}
                  </button>
                )}
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setContextMenu(null)
                    handleStartEdit()
                  }}
                >
                  {t('common.edit', '编辑')}
                </button>
              </>
            ) : (
              <>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setContextMenu(null)
                    handleStartEdit()
                  }}
                >
                  {t('common.edit', '编辑')}
                </button>
                {onRegenerate && (
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setContextMenu(null)
                      onRegenerate()
                    }}
                  >
                    {t('common.regenerate', '重新生成')}
                  </button>
                )}
              </>
            )}
            {onDelete && (
              <button
                style={{ color: '#ff4d4f' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  setContextMenu(null)
                  onDelete()
                }}
              >
                {t('common.delete', '删除')}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
