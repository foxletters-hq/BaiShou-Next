import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { useContextChainView } from './useContextChainView'
import { hasTokenUsageStats, formatCompactTokenCount } from '../../shared/token-usage-display'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

type ContextChainView = ReturnType<typeof useContextChainView>

interface ContextChainFooterProps {
  view: ContextChainView
}

export const ContextChainFooter: React.FC<ContextChainFooterProps> = ({ view }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const roundUsage = view.meta?.roundUsage
  const hasRoundUsage = roundUsage && hasTokenUsageStats(roundUsage)
  const hasNextRequest = Boolean(view.meta?.nextRequest)

  if (!hasNextRequest && !hasRoundUsage) return null

  const statChipStyle = [
    styles.statChip,
    {
      backgroundColor: colors.bgSurfaceNormal,
      borderColor: colors.borderSubtle
    }
  ]

  const statTextStyle = [styles.statText, { color: colors.textSecondary }]

  return (
    <View style={[styles.root, { borderTopColor: colors.borderSubtle }]}>
      {hasNextRequest && view.meta?.nextRequest ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {t('agent.chat.next_request_estimate', '下次请求预计')}
          </Text>
          <View style={styles.statRow}>
            <View style={statChipStyle}>
              <Text style={statTextStyle}>
                {t('agent.chat.est_context_tokens', '上下文')}{' '}
                {view.meta.nextRequest.estimatedInputTokens.toLocaleString()}{' '}
                {t('agent.chat.tokens_unit', 'tokens')}
              </Text>
            </View>
            <View style={statChipStyle}>
              <Text style={statTextStyle}>
                {t('agent.chat.context_rounds', '上下文轮数')}{' '}
                {view.meta.nextRequest.contextRoundCount} /{' '}
                {view.formatRoundLimit(view.meta.nextRequest.contextRoundLimit)}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {hasRoundUsage && roundUsage ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {t('agent.chat.this_round_usage', '本轮消耗')}
            {view.meta?.activeRoundIndex
              ? ` · ${t('agent.chat.round_label', '第 {{n}} 轮', {
                  n: view.meta.activeRoundIndex
                })}`
              : ''}
          </Text>
          <View style={styles.statRow}>
            <View style={statChipStyle}>
              <Text style={statTextStyle}>
                ↑ {t('agent.chat.round_input', '上行')} {roundUsage.inputTokens.toLocaleString()}{' '}
                tokens
              </Text>
            </View>
            <View style={statChipStyle}>
              <Text style={statTextStyle}>
                ↓ {t('agent.chat.round_output', '下行')} {roundUsage.outputTokens.toLocaleString()}{' '}
                tokens
              </Text>
            </View>
            {(roundUsage.cacheReadInputTokens ?? 0) > 0 ? (
              <View style={statChipStyle}>
                <Text
                  style={statTextStyle}
                  accessibilityLabel={t('agent.chat.cache_read', '缓存读取')}
                >
                  {t('agent.chat.cache_label', '缓存：')}
                  {formatCompactTokenCount(roundUsage.cacheReadInputTokens ?? 0)} tokens
                </Text>
              </View>
            ) : null}
            {(roundUsage.cacheWriteInputTokens ?? 0) > 0 ? (
              <View style={statChipStyle}>
                <Text
                  style={statTextStyle}
                  accessibilityLabel={t('agent.chat.cache_write', '缓存写入')}
                >
                  {t('agent.chat.cache_label', '缓存：')}
                  {formatCompactTokenCount(roundUsage.cacheWriteInputTokens ?? 0)} tokens
                </Text>
              </View>
            ) : null}
            {view.costText ? (
              <View style={statChipStyle}>
                <Text style={statTextStyle}>
                  {t('agent.chat.round_cost', '费用')} {view.costText}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: sharedTokens.spacing.xs,
    paddingTop: sharedTokens.spacing.mdTight,
    gap: sharedTokens.spacing.mdTight
  },
  section: {
    gap: sharedTokens.spacing.xsPlus
  },
  sectionTitle: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    lineHeight: 16
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.xsPlus
  },
  statChip: {
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.xsPlus,
    borderWidth: StyleSheet.hairlineWidth
  },
  statText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500',
    lineHeight: 16
  }
})
