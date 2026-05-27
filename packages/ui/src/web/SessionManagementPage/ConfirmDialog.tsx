import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './SessionManagementPage.module.css'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  isDanger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  isDanger = false,
  onConfirm,
  onCancel
}) => {
  const { t } = useTranslation()
  if (!isOpen) return null
  return (
    <div className={styles.dialogOverlay} onClick={onCancel}>
      <div className={styles.dialogBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogTitle}>{title}</div>
        <div className={styles.dialogText}>{message}</div>
        <div className={styles.dialogActions}>
          <button className={`${styles.actionBtn} ${styles.actionBtnOutline}`} onClick={onCancel}>
            {t('common.cancel', '取消')}
          </button>
          <button
            className={`${styles.actionBtn} ${isDanger ? styles.actionBtnDanger : styles.actionBtnPrimary}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
