import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { useContextChainView } from './useContextChainView'

type ContextChainView = ReturnType<typeof useContextChainView>

interface ContextChainFooterProps {
  view: ContextChainView
}

export const ContextChainFooter: React.FC<ContextChainFooterProps> = ({ view }) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const roundUsage = view.meta?.roundUsage
  const hasRoundUsage =
    roundUsage &&
    (roundUsage.inputTokens > 0 || roundUsage.outputTokens > 0 || roundUsage.costMicros > 0)
  const hasNextRequest = Boolean(view.meta?.nextRequest)

  if (!hasNextRequest && !hasRoundUsage) return null

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.borderSubtle,
        marginTop: tokens.spacing.md,
        paddingTop: tokens.spacing.md,
        gap: tokens.spacing.sm
      }}
    >
      {hasNextRequest && view.meta?.nextRequest ? (
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
            {t('agent.chat.next_request_estimate', '下次请求预计')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.md }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {t('agent.chat.est_context_tokens', '上下文')}{' '}
              {view.meta.nextRequest.estimatedInputTokens.toLocaleString()}{' '}
              {t('agent.chat.tokens_unit', 'tokens')}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {t('agent.chat.context_rounds', '上下文轮数')}{' '}
              {view.meta.nextRequest.contextRoundCount} /{' '}
              {view.formatRoundLimit(view.meta.nextRequest.contextRoundLimit)}
            </Text>
          </View>
        </View>
      ) : null}

      {hasRoundUsage && roundUsage ? (
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
            {t('agent.chat.this_round_usage', '本轮消耗')}
            {view.meta?.activeRoundIndex
              ? ` · ${t('agent.chat.round_label', '第 {{n}} 轮', {
                  n: view.meta.activeRoundIndex
                })}`
              : ''}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.md }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              ↑ {t('agent.chat.round_input', '上行')} {roundUsage.inputTokens.toLocaleString()}{' '}
              tokens
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              ↓ {t('agent.chat.round_output', '下行')} {roundUsage.outputTokens.toLocaleString()}{' '}
              tokens
            </Text>
            {view.costText ? (
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                $ {t('agent.chat.round_cost', '费用')} {view.costText}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  )
}
