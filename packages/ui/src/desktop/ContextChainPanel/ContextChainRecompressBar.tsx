import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './ContextChainPanel.module.css'

export interface ContextChainRecompressBarProps {
  busy: boolean
  error?: string | null
  onRecompress: () => void
  onDismissError?: () => void
}

export const ContextChainRecompressBar: React.FC<ContextChainRecompressBarProps> = ({
  busy,
  error,
  onRecompress,
  onDismissError
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.recompressBar}>
      <button
        type="button"
        className={styles.recompressTrigger}
        disabled={busy}
        title={t('agent.chat.recompress_hint', '按上次压缩触发时的消息范围，重新生成对话摘要')}
        onClick={onRecompress}
      >
        {busy
          ? t('agent.chat.recompress_running', '压缩中…')
          : t('agent.chat.recompress_btn', '重新压缩')}
      </button>
      {error && (
        <p className={styles.recompressError}>
          {error}
          {onDismissError && (
            <button
              type="button"
              className={styles.recompressErrorDismiss}
              onClick={onDismissError}
            >
              {t('common.dismiss', '关闭')}
            </button>
          )}
        </p>
      )}
    </div>
  )
}
