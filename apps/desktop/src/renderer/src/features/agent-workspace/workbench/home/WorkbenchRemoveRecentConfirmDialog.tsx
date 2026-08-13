import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { withAppContentOverlay } from '@baishou/ui'
import styles from './WorkbenchRemoveRecentConfirmDialog.module.css'

export interface WorkbenchRemoveRecentConfirmDialogProps {
  open: boolean
  projectName: string
  onConfirm: (dontAskAgain: boolean) => void
  onCancel: () => void
}

/** 移除最近项目记录确认；可选「不再提示」 */
export const WorkbenchRemoveRecentConfirmDialog: React.FC<
  WorkbenchRemoveRecentConfirmDialogProps
> = ({ open, projectName, onConfirm, onCancel }) => {
  const { t } = useTranslation()
  const [dontAskAgain, setDontAskAgain] = useState(false)

  useEffect(() => {
    if (!open) return
    setDontAskAgain(false)
  }, [open])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className={withAppContentOverlay(styles.overlay)} onClick={onCancel}>
      <div
        className={styles.box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workbench-remove-recent-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="workbench-remove-recent-title" className={styles.title}>
          {t('workbench.home_remove_workspace', '移除工作目录')}
        </h2>
        <p className={styles.message}>
          {t(
            'workbench.home_remove_workspace_confirm',
            '将「{{name}}」从工作目录列表中移除？磁盘上的文件不会被删除。',
            { name: projectName }
          )}
        </p>
        <button
          type="button"
          className={`${styles.checkboxRow} ${dontAskAgain ? styles.checkboxRowChecked : ''}`}
          onClick={() => setDontAskAgain((v) => !v)}
          aria-pressed={dontAskAgain}
        >
          <span className={styles.checkboxBox} aria-hidden>
            {dontAskAgain ? <Check size={12} strokeWidth={3} /> : null}
          </span>
          <span className={styles.checkboxLabel}>
            {t('workbench.home_remove_dont_ask_again', '不再提示')}
          </span>
        </button>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            {t('common.cancel', '取消')}
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={() => onConfirm(dontAskAgain)}
          >
            {t('common.confirm', '确定')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
