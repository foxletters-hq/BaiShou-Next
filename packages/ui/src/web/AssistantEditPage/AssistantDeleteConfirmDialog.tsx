import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import styles from './AssistantEditPage.module.css'

interface AssistantDeleteConfirmDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const AssistantDeleteConfirmDialog: React.FC<AssistantDeleteConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel
}) => {
  const { t } = useTranslation()

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen])

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div className={styles.dialogOverlay} onClick={onCancel}>
      <div className={styles.dialogBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogHeaderIcon}>
          <Trash2 size={32} color="var(--color-error, #F44336)" />
        </div>
        <div className={styles.dialogTitle}>{t('agent.assistant.delete_confirm_title')}</div>
        <div className={styles.dialogText}>{t('agent.assistant.delete_confirm_content')}</div>
        <div className={styles.dialogActions}>
          <button className={`${styles.dialogBtn} ${styles.dialogBtnCancel}`} onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button className={`${styles.dialogBtn} ${styles.dialogBtnDanger}`} onClick={onConfirm}>
            {t('common.delete')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
