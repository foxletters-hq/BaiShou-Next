import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../Button/Button'
import { withAppContentOverlay } from '../overlay'
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
  isDanger: _isDanger = false,
  onConfirm,
  onCancel
}) => {
  const { t } = useTranslation()
  if (!isOpen) return null
  return (
    <div className={withAppContentOverlay(styles.dialogOverlay)} onClick={onCancel}>
      <div className={styles.dialogBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogTitle}>{title}</div>
        <div className={styles.dialogText}>{message}</div>
        <div className={styles.dialogActions}>
          <Button type="button" onClick={onCancel}>
            {t('common.cancel', '取消')}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
