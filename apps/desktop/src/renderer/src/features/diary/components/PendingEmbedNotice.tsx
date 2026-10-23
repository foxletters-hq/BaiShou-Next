import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Library, X } from 'lucide-react'
import styles from './PendingEmbedNotice.module.css'

const AUTO_DISMISS_SECONDS = 3

export interface PendingEmbedNoticeProps {
  count: number
  needModel: boolean
  onAction: () => void
  onDismiss: () => void
  onMuteStartupReminder?: () => void
}

export const PendingEmbedNotice: React.FC<PendingEmbedNoticeProps> = ({
  count,
  needModel,
  onAction,
  onDismiss,
  onMuteStartupReminder
}) => {
  const { t } = useTranslation()
  const [secondsLeft, setSecondsLeft] = useState(AUTO_DISMISS_SECONDS)
  const pausedRef = useRef(false)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  const message = needModel
    ? t(
        'memory.pending_embed_reminder_need_model',
        '有 {{count}} 项内容还没有嵌入，需要先配置嵌入模型才能补齐',
        { count }
      )
    : t(
        'memory.pending_embed_reminder',
        '有 {{count}} 项内容还没有嵌入，搜索和伙伴回忆暂时用不到它们',
        { count }
      )
  const action = needModel
    ? t('memory.pending_embed_reminder_need_model_action', '去配置模型')
    : t('memory.pending_embed_reminder_action', '去补齐')

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (pausedRef.current) return
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (secondsLeft > 0) return
    onDismissRef.current()
  }, [secondsLeft])

  return createPortal(
    <div
      className={styles.anchor}
      role="status"
      onMouseEnter={() => {
        pausedRef.current = true
      }}
      onMouseLeave={() => {
        pausedRef.current = false
      }}
    >
      <div className={styles.body}>
        <button type="button" className={styles.banner} onClick={onAction}>
          <span className={styles.icon} aria-hidden>
            <Library size={16} />
          </span>
          <span className={styles.copy}>
            <span className={styles.message}>{message}</span>
            <span className={styles.action}>
              {action}
              <ChevronRight size={14} aria-hidden />
            </span>
          </span>
        </button>
        <div className={styles.footer}>
          {onMuteStartupReminder ? (
            <button type="button" className={styles.mute} onClick={onMuteStartupReminder}>
              {t('memory.pending_embed_reminder_mute', '不再自动提示')}
            </button>
          ) : null}
          <span className={styles.countdown}>
            {t('memory.pending_embed_reminder_autoclose', '{{count}} 秒后关闭', {
              count: secondsLeft
            })}
          </span>
        </div>
      </div>
      <button
        type="button"
        className={styles.dismiss}
        aria-label={t('common.close', '关闭')}
        onClick={onDismiss}
      >
        <X size={14} />
      </button>
    </div>,
    document.body
  )
}
