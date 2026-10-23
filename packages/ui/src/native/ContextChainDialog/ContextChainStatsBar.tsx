import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { MockChatMessage } from './context-chain-dialog.types'
import { hasTokenUsageStats, formatCompactTokenCount } from '../../shared/token-usage-display'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

interface ContextChainStatsBarProps {
  message: MockChatMessage
}

export const ContextChainStatsBar: React.FC<ContextChainStatsBarProps> = ({ message }) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const totalInputTokens = message.inputTokens || 0
  const totalOutputTokens = message.outputTokens || 0
  const cacheRead = message.cacheReadInputTokens || 0
  const cacheWrite = message.cacheWriteInputTokens || 0
  const costText = message.costMicros ? `$${(message.costMicros / 1000000).toFixed(4)}` : null

  if (
    !hasTokenUsageStats({
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheReadInputTokens: cacheRead,
      cacheWriteInputTokens: cacheWrite,
      costMicros: message.costMicros
    })
  ) {
    return null
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: sharedTokens.spacing.sm,
        paddingHorizontal: sharedTokens.spacing.smPlus,
        paddingVertical: sharedTokens.spacing.sm,
        backgroundColor: colors.bgSurfaceNormal,
        borderRadius: tokens.radius.sm,
        marginBottom: sharedTokens.spacing.mdTight
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.xs }}>
        <Text style={{ fontSize: mobileTypography.caption.fontSize, color: colors.textSecondary }}>
          ↑
        </Text>
        <Text style={{ fontSize: mobileTypography.caption.fontSize, color: colors.textSecondary }}>
          {t('agent.chat.round_input', '入')} {totalInputTokens}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.xs }}>
        <Text style={{ fontSize: mobileTypography.caption.fontSize, color: colors.textSecondary }}>
          ↓
        </Text>
        <Text style={{ fontSize: mobileTypography.caption.fontSize, color: colors.textSecondary }}>
          {t('agent.chat.round_output', '出')} {totalOutputTokens}
        </Text>
      </View>
      {cacheRead > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.xs }}>
          <Text
            style={{ fontSize: mobileTypography.caption.fontSize, color: colors.textSecondary }}
            accessibilityLabel={t('agent.chat.cache_read', '缓存读取')}
          >
            {t('agent.chat.cache_label', '缓存：')}
            {formatCompactTokenCount(cacheRead)}
          </Text>
        </View>
      ) : null}
      {cacheWrite > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.xs }}>
          <Text
            style={{ fontSize: mobileTypography.caption.fontSize, color: colors.textSecondary }}
            accessibilityLabel={t('agent.chat.cache_write', '缓存写入')}
          >
            {t('agent.chat.cache_label', '缓存：')}
            {formatCompactTokenCount(cacheWrite)}
          </Text>
        </View>
      ) : null}
      {costText && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.xs }}>
          <Text
            style={{ fontSize: mobileTypography.caption.fontSize, color: colors.textSecondary }}
          >
            {t('agent.chat.round_cost', '耗')} {costText}
          </Text>
        </View>
      )}
    </View>
  )
}
