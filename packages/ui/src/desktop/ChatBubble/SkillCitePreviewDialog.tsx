import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Sparkles, X } from 'lucide-react'
import { Modal } from '../Modal/Modal'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import { useToast } from '../Toast/useToast'
import styles from './UserMessageSkillContent.module.css'

type Props = {
  open: boolean
  command: string
  content: string
  onClose: () => void
}

export function SkillCitePreviewDialog({ open, command, content, onClose }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const normalizedCommand = command.replace(/^\//, '').trim()
  const hasContent = Boolean(content.trim())
  const title = t('shortcut.view_skill', '查看 Skill')

  const handleCopy = useCallback(async () => {
    if (!hasContent) return
    try {
      await navigator.clipboard.writeText(content)
      toast.showSuccess(t('common.copied', '已复制到剪贴板'))
    } catch {
      toast.showError(t('common.copy_failed', '复制失败'))
    }
  }, [content, hasContent, t, toast])

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      closeOnOverlayClick
      animation="fade"
      className={styles.previewModal}
      overlayClassName={styles.previewOverlay}
      zIndex={2800}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={styles.previewPanel}>
        <header className={styles.previewHeader}>
          <Sparkles size={16} className={styles.previewHeaderIcon} aria-hidden />
          <h2 className={styles.previewTitle}>{title}</h2>
          {normalizedCommand ? (
            <span className={styles.previewCommandChip}>/{normalizedCommand}</span>
          ) : null}
          <div className={styles.previewHeaderActions}>
            {hasContent ? (
              <button
                type="button"
                className={styles.previewHeaderBtn}
                onClick={() => void handleCopy()}
              >
                <Copy size={14} aria-hidden />
                {t('common.copy', '复制')}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.previewClose}
              onClick={onClose}
              aria-label={t('common.close', '关闭')}
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className={styles.previewBody}>
          {hasContent ? (
            <AgentMarkdownRenderer content={content} />
          ) : (
            <p className={styles.previewEmpty}>
              {t('shortcut.skill_content_empty', '该 Skill 暂无正文内容')}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
