import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@baishou/ui'
import styles from './GraphPage.module.css'

const CONFIRM_DELAY_MS = 3000

export type GraphMergeConfirmTarget = {
  survivorId: string
  survivorName: string
  losers: Array<{ id: string; name: string }>
}

export const GraphIrreversibleConfirm: React.FC<{
  isOpen: boolean
  title: string
  warning: string
  detail?: React.ReactNode
  confirmLabel?: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}> = ({ isOpen, title, warning, detail, confirmLabel, busy, onCancel, onConfirm }) => {
  const { t } = useTranslation()
  const [remainMs, setRemainMs] = useState(CONFIRM_DELAY_MS)

  useEffect(() => {
    if (!isOpen) {
      setRemainMs(CONFIRM_DELAY_MS)
      return
    }
    setRemainMs(CONFIRM_DELAY_MS)
    const started = Date.now()
    const timer = window.setInterval(() => {
      const left = Math.max(0, CONFIRM_DELAY_MS - (Date.now() - started))
      setRemainMs(left)
      if (left <= 0) window.clearInterval(timer)
    }, 200)
    return () => window.clearInterval(timer)
  }, [isOpen])

  const remainSec = Math.ceil(remainMs / 1000)
  const ready = remainMs <= 0 && !busy

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} zIndex={1900}>
      <p className={styles.irreversibleWarning}>{warning}</p>
      {detail}
      <div className={styles.mergeDialogFooter}>
        <button type="button" className={styles.btn} disabled={busy} onClick={onCancel}>
          {t('common.cancel', '取消')}
        </button>
        <button
          type="button"
          className={styles.btnDanger}
          disabled={!ready}
          onClick={onConfirm}
        >
          {ready
            ? (confirmLabel ?? t('graph.merge_confirm', '确认合并'))
            : t('graph.merge_confirm_wait', '请等待 {{sec}} 秒', { sec: remainSec })}
        </button>
      </div>
    </Modal>
  )
}
