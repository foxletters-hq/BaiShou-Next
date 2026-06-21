import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import styles from './RestoreBlockingOverlay.module.css'

export interface RestoreBlockingOverlayProps {
  visible: boolean
  message?: string
  hint?: string
}

export const RestoreBlockingOverlay: React.FC<RestoreBlockingOverlayProps> = ({
  visible,
  message,
  hint
}) => {
  const { t } = useTranslation()
  const resolvedMessage = message ?? t('settings.restoring_data', '正在恢复数据...')
  const resolvedHint =
    hint ?? t('settings.restoring_data_hint', '请勿关闭应用或进行其他操作，恢复完成后将自动刷新')

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [visible])

  if (!visible || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={styles.overlay}
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={resolvedMessage}
    >
      <div className={styles.panel}>
        <Loader2 className={styles.spinner} size={40} aria-hidden />
        <p className={styles.message}>{resolvedMessage}</p>
        {resolvedHint ? <p className={styles.hint}>{resolvedHint}</p> : null}
      </div>
    </div>,
    document.body
  )
}
