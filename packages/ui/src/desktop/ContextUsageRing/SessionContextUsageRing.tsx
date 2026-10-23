import React, { useMemo } from 'react'
import {
  resolveSessionContextUsage,
  shouldShowSessionContextUsageRing,
  type LastRoundUsageMessage,
  type SessionTokenTotals
} from '@baishou/shared'
import { ContextUsageRing, type ContextUsageRingProps } from './index'

export interface SessionContextUsageRingProps {
  messages: readonly LastRoundUsageMessage[]
  modelId?: string | null
  totals: SessionTokenTotals
  pricingLastUpdated?: Date | null
  onRefreshPricing?: ContextUsageRingProps['onRefreshPricing']
  pricingSourceUrl?: string
  hidden?: boolean
}

/** 伙伴页与工作台共用的会话用量圆圈：自己算上一轮占用和累计消耗 */
export const SessionContextUsageRing: React.FC<SessionContextUsageRingProps> = ({
  messages,
  modelId,
  totals,
  pricingLastUpdated,
  onRefreshPricing,
  pricingSourceUrl,
  hidden
}) => {
  const resolved = useMemo(
    () => resolveSessionContextUsage({ messages, modelId, totals }),
    // totals 按字段列依赖，避免父组件每次新对象都重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      messages,
      modelId,
      totals.totalInputTokens,
      totals.totalOutputTokens,
      totals.totalCacheReadInputTokens,
      totals.totalCacheWriteInputTokens,
      totals.estimatedCost
    ]
  )
  if (!shouldShowSessionContextUsageRing({ messageCount: messages.length, hidden })) return null
  return (
    <ContextUsageRing
      lastRound={resolved.lastRound}
      contextWindow={resolved.contextWindow}
      occupancy={resolved.occupancy}
      cumulative={resolved.cumulative}
      pricingLastUpdated={pricingLastUpdated}
      onRefreshPricing={onRefreshPricing}
      pricingSourceUrl={pricingSourceUrl}
    />
  )
}
