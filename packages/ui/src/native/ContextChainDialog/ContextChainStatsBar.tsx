import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { MockChatMessage } from './context-chain-dialog.types'

interface ContextChainStatsBarProps {
  message: MockChatMessage
}

export const ContextChainStatsBar: React.FC<ContextChainStatsBarProps> = ({ message }) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const totalInputTokens = message.inputTokens || 0
  const totalOutputTokens = message.outputTokens || 0
  const costText = message.costMicros ? `$${(message.costMicros / 1000000).toFixed(4)}` : null

  if (totalInputTokens <= 0 && totalOutputTokens <= 0) return null

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: tokens.spacing.sm,
        padding: tokens.spacing.sm,
        backgroundColor: colors.bgSurfaceNormal,
        borderRadius: tokens.radius.md,
        marginBottom: tokens.spacing.sm
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: 12 }}>↑</Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
          {t('agent.chat.round_input', '入')} {totalInputTokens}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: 12 }}>↓</Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
          {t('agent.chat.round_output', '出')} {totalOutputTokens}
        </Text>
      </View>
      {costText && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 12 }}>$</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            {t('agent.chat.round_cost', '耗')} {costText}
          </Text>
        </View>
      )}
    </View>
  )
}
