import React from 'react'
import styles from './TokenBadge.module.css'

export interface TokenBadgeProps {
  inputTokens?: number
  outputTokens?: number
  costMicros?: number
  durationMs?: number // legacy prop alias
  onClick?: () => void
  className?: string
  /** 聊天顶栏：与伙伴选择器同高 */
  variant?: 'default' | 'toolbar'
}

export const TokenBadge: React.FC<TokenBadgeProps> = ({
  inputTokens = 0,
  outputTokens = 0,
  costMicros = 0,
  durationMs = 0,
  onClick,
  className,
  variant = 'default'
}) => {
  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return `${n}`
  }

  const actualCostMicros = costMicros || durationMs || 0
  const costText = (actualCostMicros / 1000000).toFixed(4)
  const total = inputTokens + outputTokens

  return (
    <div
      className={`${styles.container} ${variant === 'toolbar' ? styles.toolbar : ''} ${className ?? ''}`.trim()}
      onClick={onClick}
    >
      <span className={styles.tokenText}>{formatTokens(total)}</span>
      {costText && (
        <>
          <span className={styles.divider} />
          <span className={styles.costText}>${costText}</span>
        </>
      )}
    </div>
  )
}
