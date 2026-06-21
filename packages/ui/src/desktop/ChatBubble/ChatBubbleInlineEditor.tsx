import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './ChatBubble.module.css'

interface ChatBubbleInlineEditorProps {
  isUser: boolean
  editedContent: string
  onChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onCancel: () => void
  onSave: () => void
  onResend?: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

export const ChatBubbleInlineEditor: React.FC<ChatBubbleInlineEditorProps> = ({
  isUser,
  editedContent,
  onChange,
  onKeyDown,
  onCancel,
  onSave,
  onResend,
  textareaRef
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.editorContainer}>
      <textarea
        ref={textareaRef}
        className={styles.editorTextarea}
        value={editedContent}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
      />
      <div className={styles.editorActions}>
        <button
          type="button"
          className={`${styles.editorBtn} ${styles.editorBtnCancel}`}
          onClick={onCancel}
        >
          {t('common.cancel', '取消')}
        </button>
        {!isUser && (
          <button
            type="button"
            className={`${styles.editorBtn} ${styles.editorBtnSave}`}
            onClick={onSave}
          >
            {t('common.save', '保存')}
          </button>
        )}
        {isUser && onResend && (
          <button
            type="button"
            className={`${styles.editorBtn} ${styles.editorBtnResend}`}
            onClick={onResend}
          >
            {t('common.resend', '重新发送')}
          </button>
        )}
      </div>
    </div>
  )
}
