import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  Modal,
  SafeAreaView,
  StyleSheet,
  Linking,
  ActivityIndicator
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button } from '../Button'
import { modalActionsStyle } from '../Modal/Modal'
import { useNativeTheme } from '../theme'
import { formatLocaleTokenCount } from '../../shared/token-usage-display'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface CostDetails {
  modelName?: string
  promptTokens: number
  completionTokens: number
  totalTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  estimatedCost: string
  lastInputTokens?: number
}

export interface ChatCostDialogProps {
  details: CostDetails
  onClose: () => void
  /** 与桌面端一致 */
  isOpen?: boolean
  /** 兼容旧移动端调用 */
  visible?: boolean
  pricingLastUpdated?: Date | null
  onRefreshPricing?: () => Promise<{ success: boolean; error?: string }>
  pricingSourceUrl?: string
}

export const ChatCostDialog: React.FC<ChatCostDialogProps> = ({
  details,
  onClose,
  isOpen,
  visible,
  pricingLastUpdated,
  onRefreshPricing,
  pricingSourceUrl
}) => {
  const { t } = useTranslation()
  const { colors, maxModalWidth } = useNativeTheme()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const open = isOpen ?? visible ?? false
  const sourceUrl = pricingSourceUrl || 'https://models.dev'

  const formatLastUpdated = useCallback(
    (date: Date | null | undefined): string => {
      if (!date) return t('agent.chat.pricing_unknown', '未知')
      const pad = (n: number) => n.toString().padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    },
    [t]
  )

  const handleRefresh = useCallback(async () => {
    if (!onRefreshPricing || isRefreshing) return
    setIsRefreshing(true)
    setRefreshError(null)
    try {
      const result = await onRefreshPricing()
      if (!result.success) {
        setRefreshError(result.error || t('agent.chat.pricing_refresh_failed', '请检查网络环境'))
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setRefreshError(msg || t('agent.chat.pricing_refresh_failed', '请检查网络环境'))
    } finally {
      setIsRefreshing(false)
    }
  }, [onRefreshPricing, isRefreshing, t])

  if (!open) return null

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <SafeAreaView style={styles.safeArea}>
          <Pressable
            style={[
              styles.dialog,
              {
                maxWidth: maxModalWidth,
                backgroundColor: colors.bgSurface,
                borderRadius: 28
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('agent.chat.cost_detail_title', '当前计费')}
            </Text>

            <View style={styles.content}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('agent.chat.cost_cumulative_title', '累计 API 消耗')}
              </Text>
              <View style={styles.spacer8} />

              <View style={styles.costRow}>
                <Text style={[styles.costLabel, { color: colors.textSecondary }]}>
                  {t('agent.chat.cost_cumulative_total', '累计费用')}
                </Text>
                <Text style={[styles.costValue, { color: colors.textPrimary }]}>
                  {details.estimatedCost}
                </Text>
              </View>
              <View style={styles.costRow}>
                <Text style={[styles.costLabel, { color: colors.textSecondary }]}>
                  {t('agent.chat.cost_cumulative_input', '累计输入')}
                </Text>
                <Text style={[styles.costValue, { color: colors.textPrimary }]}>
                  {formatLocaleTokenCount(details.promptTokens)}{' '}
                  {t('agent.chat.tokens_unit', 'tokens')}
                </Text>
              </View>
              <View style={styles.costRow}>
                <Text style={[styles.costLabel, { color: colors.textSecondary }]}>
                  {t('agent.chat.cost_cumulative_output', '累计输出')}
                </Text>
                <Text style={[styles.costValue, { color: colors.textPrimary }]}>
                  {formatLocaleTokenCount(details.completionTokens)}{' '}
                  {t('agent.chat.tokens_unit', 'tokens')}
                </Text>
              </View>
              {(details.cacheReadTokens ?? 0) > 0 ? (
                <View style={styles.costRow}>
                  <Text style={[styles.costLabel, { color: colors.textSecondary }]}>
                    {t('agent.chat.cost_cumulative_cache_read', '缓存读取')}
                  </Text>
                  <Text style={[styles.costValue, { color: colors.textPrimary }]}>
                    {formatLocaleTokenCount(details.cacheReadTokens!)}{' '}
                    {t('agent.chat.tokens_unit', 'tokens')}
                  </Text>
                </View>
              ) : null}
              {(details.cacheWriteTokens ?? 0) > 0 ? (
                <View style={styles.costRow}>
                  <Text style={[styles.costLabel, { color: colors.textSecondary }]}>
                    {t('agent.chat.cost_cumulative_cache_write', '缓存写入')}
                  </Text>
                  <Text style={[styles.costValue, { color: colors.textPrimary }]}>
                    {formatLocaleTokenCount(details.cacheWriteTokens!)}{' '}
                    {t('agent.chat.tokens_unit', 'tokens')}
                  </Text>
                </View>
              ) : null}

              <View style={[styles.divider, { borderBottomColor: colors.borderSubtle }]} />

              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('agent.chat.pricing_table_title', '价格表信息')}
              </Text>
              <View style={styles.spacer8} />

              <View style={styles.costRow}>
                <Text style={[styles.costLabel, { color: colors.textSecondary }]}>
                  {t('agent.chat.pricing_last_updated', '最后更新')}
                </Text>
                <Text style={[styles.costValue, { color: colors.textPrimary }]}>
                  {formatLastUpdated(pricingLastUpdated)}
                </Text>
              </View>

              <View style={styles.costRow}>
                <Text style={[styles.costLabel, { color: colors.textSecondary }]}>
                  {t('agent.chat.pricing_source', '价格数据源')}
                </Text>
                <View style={styles.pricingSourceContainer}>
                  <Pressable onPress={() => void Linking.openURL(sourceUrl)}>
                    <Text style={[styles.sourceLink, { color: colors.primary }]}>models.dev</Text>
                  </Pressable>
                  {onRefreshPricing ? (
                    <Pressable
                      style={[
                        styles.refreshButtonInline,
                        { borderColor: colors.primary },
                        isRefreshing && styles.refreshButtonDisabled
                      ]}
                      onPress={() => void handleRefresh()}
                      disabled={isRefreshing}
                    >
                      {isRefreshing ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Text style={[styles.refreshButtonText, { color: colors.primary }]}>
                          {t('agent.chat.pricing_refresh', '刷新')}
                        </Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {refreshError ? (
                <View style={[styles.errorMessage, { backgroundColor: colors.errorContainer }]}>
                  <Text
                    style={{ color: colors.error, fontSize: mobileTypography.caption.fontSize }}
                  >
                    {refreshError}
                  </Text>
                </View>
              ) : null}

              <View style={styles.spacer16} />

              <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
                {t(
                  'agent.chat.cost_disclaimer',
                  '提示：此费用计算数据来自本地 pricing 规则 (或 models.dev)，存在更新不及时或计费方式不同的情况，仅供参考。'
                )}
              </Text>
            </View>

            <View
              style={[
                modalActionsStyle,
                {
                  paddingHorizontal: sharedTokens.spacing.lg,
                  paddingTop: sharedTokens.spacing.md,
                  paddingBottom: sharedTokens.spacing.lg
                }
              ]}
            >
              <Button size="sm" variant="outlined" onPress={onClose}>
                {t('common.confirm', '确认')}
              </Button>
            </View>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.mdPlus
  },
  safeArea: {
    width: '100%',
    alignItems: 'center'
  },
  dialog: {
    width: '100%',
    maxWidth: 400
  },
  title: {
    paddingTop: sharedTokens.spacing.lg,
    paddingHorizontal: sharedTokens.spacing.lg,
    paddingBottom: sharedTokens.spacing.md,
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600',
    lineHeight: 28
  },
  content: {
    paddingHorizontal: sharedTokens.spacing.lg
  },
  sectionTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  spacer8: { height: 8 },
  spacer16: { height: 16 },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sharedTokens.spacing.xsPlus,
    gap: sharedTokens.spacing.mdTight
  },
  costLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20,
    flexShrink: 0
  },
  costValue: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'right',
    flex: 1
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: sharedTokens.spacing.md
  },
  disclaimer: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  },
  pricingSourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    flex: 1,
    justifyContent: 'flex-end'
  },
  sourceLink: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  refreshButtonInline: {
    borderWidth: 1,
    borderRadius: sharedTokens.radius.md,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.xs,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center'
  },
  refreshButtonDisabled: {
    opacity: 0.5
  },
  refreshButtonText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  },
  errorMessage: {
    marginTop: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm
  },
  actions: {
    paddingTop: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.lg,
    paddingHorizontal: sharedTokens.spacing.lg,
    alignItems: 'flex-end'
  },
  textButton: {
    paddingVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.mdTight
  },
  textButtonLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500',
    textTransform: 'uppercase'
  }
})
