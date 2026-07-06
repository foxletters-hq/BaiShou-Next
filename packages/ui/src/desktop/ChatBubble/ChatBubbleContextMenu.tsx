import React, { useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { applyFixedContextMenuLayout } from '../ContextMenu/context-menu-placement.util'
import styles from './ChatBubble.module.css'

interface ChatBubbleContextMenuProps {
  contextMenu: { x: number; y: number } | null
  isUser: boolean
  onDismiss: () => void
  onCopy: (e?: React.MouseEvent) => void
  onStartEdit: () => void
  onResend?: () => void
  onRegenerate?: () => void
  onDelete?: () => void
}

export const ChatBubbleContextMenu: React.FC<ChatBubbleContextMenuProps> = ({
  contextMenu,
  isUser,
  onDismiss,
  onCopy,
  onStartEdit,
  onResend,
  onRegenerate,
  onDelete
}) => {
  const { t } = useTranslation()
  const chatMenuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!contextMenu || !chatMenuRef.current) return
    applyFixedContextMenuLayout(chatMenuRef.current, contextMenu.x, contextMenu.y)
  }, [contextMenu, isUser, onDelete, onRegenerate, onResend])

  if (!contextMenu || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={styles.contextMenuOverlay}
      onMouseDown={(e) => {
        e.preventDefault()
        onDismiss()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onDismiss()
      }}
    >
      <div
        ref={chatMenuRef}
        className={styles.contextMenu}
        style={{ top: contextMenu.y, left: contextMenu.x }}
      >
        <button type="button" onMouseDown={onCopy}>
          {t('common.copy', '复制')}
        </button>
        {isUser ? (
          <>
            {onResend && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onDismiss()
                  onResend()
                }}
              >
                {t('common.retry', '重新发送')}
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onDismiss()
                onStartEdit()
              }}
            >
              {t('common.edit', '编辑')}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onDismiss()
                onStartEdit()
              }}
            >
              {t('common.edit', '编辑')}
            </button>
            {onRegenerate && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onDismiss()
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
            type="button"
            style={{ color: '#ff4d4f' }}
            onMouseDown={(e) => {
              e.preventDefault()
              onDismiss()
              onDelete()
            }}
          >
            {t('common.delete', '删除')}
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}
