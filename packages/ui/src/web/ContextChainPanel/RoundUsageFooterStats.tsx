import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TokenUsageDisplay } from '../../shared/token-usage-display'
import { formatCompactTokenCount } from '../../shared/token-usage-display'

interface RoundUsageFooterStatsProps {
  usage: TokenUsageDisplay
  costText?: string | null
  className?: string
  statClassName?: string
}

/** 本轮消耗 footer 中的 token / 缓存 / 费用统计行 */
export const RoundUsageFooterStats: React.FC<RoundUsageFooterStatsProps> = ({
  usage,
  costText,
  className,
  statClassName
}) => {
  const { t } = useTranslation()
  const cacheRead = usage.cacheReadInputTokens ?? 0
  const cacheWrite = usage.cacheWriteInputTokens ?? 0

  return (
    <div className={className}>
      <span className={statClassName}>
        ↑ {t('agent.chat.round_input', '上行')} {(usage.inputTokens ?? 0).toLocaleString()} tokens
      </span>
      <span className={statClassName}>
        ↓ {t('agent.chat.round_output', '下行')} {(usage.outputTokens ?? 0).toLocaleString()}{' '}
        tokens
      </span>
      {cacheRead > 0 ? (
        <span className={statClassName} title={t('agent.chat.cache_read', '缓存读取')}>
          {t('agent.chat.cache_label', '缓存：')}
          {formatCompactTokenCount(cacheRead)} tokens
        </span>
      ) : null}
      {cacheWrite > 0 ? (
        <span className={statClassName} title={t('agent.chat.cache_write', '缓存写入')}>
          {t('agent.chat.cache_label', '缓存：')}
          {formatCompactTokenCount(cacheWrite)} tokens
        </span>
      ) : null}
      {costText ? (
        <span className={statClassName}>
          $ {t('agent.chat.round_cost', '费用')} {costText}
        </span>
      ) : null}
    </div>
  )
}
