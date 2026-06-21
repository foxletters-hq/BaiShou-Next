import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './CompressionDivider.module.css'

export interface CompressionDividerProps {
  className?: string
}

/** 对话时间线上的压缩分界：实线 + 居中标签 */
export const CompressionDivider: React.FC<CompressionDividerProps> = ({ className }) => {
  const { t } = useTranslation()

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      role="separator"
      aria-label={t('agent.chat.compression_divider_aria', '对话已压缩')}
    >
      <span className={styles.line} aria-hidden />
      <span className={styles.label}>{t('agent.chat.compression_divider', '对话已压缩')}</span>
      <span className={styles.line} aria-hidden />
    </div>
  )
}
