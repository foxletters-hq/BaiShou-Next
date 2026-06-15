import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TokenUsageDisplay } from '../../shared/token-usage-display'
import { formatCompactTokenCount } from '../../shared/token-usage-display'
import styles from './ChatBubble.module.css'

export const ChatBubbleTokenRow: React.FC<{ usage: TokenUsageDisplay }> = ({ usage }) => {
  const { t } = useTranslation()
  const input = usage.inputTokens ?? 0
  const output = usage.outputTokens ?? 0
  const cacheRead = usage.cacheReadInputTokens ?? 0
  const cacheWrite = usage.cacheWriteInputTokens ?? 0
  const costMicros = usage.costMicros ?? 0

  if (input <= 0 && output <= 0 && costMicros <= 0 && cacheRead <= 0 && cacheWrite <= 0) {
    return null
  }

  return (
    <div className={styles.tokenRow}>
      {input > 0 ? (
        <span className={styles.tokenStat}>↑{formatCompactTokenCount(input)}</span>
      ) : null}
      {output > 0 ? (
        <span className={styles.tokenStat}>↓{formatCompactTokenCount(output)}</span>
      ) : null}
      {costMicros > 0 ? (
        <span className={styles.tokenStat}>${(costMicros / 1_000_000).toFixed(4)}</span>
      ) : null}
      {cacheRead > 0 ? (
        <span className={styles.tokenStat} title={t('agent.chat.cache_read', '缓存读取')}>
          {t('agent.chat.cache_label', '缓存：')}
          {formatCompactTokenCount(cacheRead)}
        </span>
      ) : null}
      {cacheWrite > 0 ? (
        <span className={styles.tokenStat} title={t('agent.chat.cache_write', '缓存写入')}>
          {t('agent.chat.cache_label', '缓存：')}
          {formatCompactTokenCount(cacheWrite)}
        </span>
      ) : null}
    </div>
  )
}
