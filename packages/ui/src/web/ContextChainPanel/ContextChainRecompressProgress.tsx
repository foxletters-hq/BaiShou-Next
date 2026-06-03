import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './ContextChainPanel.module.css'

export interface ContextChainRecompressProgressProps {
  /** 任务开始时间戳（ms），用于显示已用时长 */
  startedAt?: number
  /** embedded：显示在右侧「对话压缩」详情区内 */
  variant?: 'panel' | 'embedded'
}

/**
 * 重新压缩进度条：压缩没有确定百分比，使用不确定（indeterminate）动画 + 已用秒数，
 * 视觉上参考记忆页「AI 生成中」的进行态提示。
 */
export const ContextChainRecompressProgress: React.FC<ContextChainRecompressProgressProps> = ({
  startedAt,
  variant = 'panel'
}) => {
  const { t } = useTranslation()
  const [elapsed, setElapsed] = React.useState(() =>
    startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0
  )

  React.useEffect(() => {
    if (!startedAt) return
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - startedAt) / 1000)))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [startedAt])

  const rootClass =
    variant === 'embedded'
      ? `${styles.recompressProgress} ${styles.recompressProgressEmbedded}`
      : styles.recompressProgress

  return (
    <div className={rootClass} role="status" aria-live="polite">
      <div className={styles.recompressProgressHead}>
        <span className={styles.recompressProgressSpinner} aria-hidden />
        <span className={styles.recompressProgressTitle}>
          {t('agent.chat.recompress_running', '压缩中…')}
        </span>
        {startedAt != null && <span className={styles.recompressProgressElapsed}>{elapsed}s</span>}
      </div>
      <div className={styles.recompressProgressTrack} aria-hidden>
        <div className={styles.recompressProgressBar} />
      </div>
      <span className={styles.recompressProgressHint}>
        {t(
          'agent.chat.recompress_banner_hint',
          '正在重新生成对话摘要，可切换条目或切换页面，完成后会自动更新'
        )}
      </span>
    </div>
  )
}
