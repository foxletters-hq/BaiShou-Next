import { useTranslation } from 'react-i18next'
import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useNativeTheme } from '../../native/theme'
import { iconSizes, mobileTypography, sharedTokens } from '../../theme/tokens'

interface MissingSummaryCardProps {
  type: 'week' | 'month' | 'quarter' | 'year'
  dateRange: string
  onGenerate: () => void
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'

export const MissingSummaryCard: React.FC<MissingSummaryCardProps> = ({
  type,
  dateRange,
  onGenerate
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View
      style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }]}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.warning + '20' }]}>
        <Text style={styles.calendarIcon}>📅</Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {t(`summary.missing_title_${type}`)}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.date, { color: colors.textSecondary }]}>{dateRange}</Text>
          <View style={[styles.suggestionBadge, { backgroundColor: colors.warning + '20' }]}>
            <Text style={[styles.suggestionText, { color: colors.warning }]}>
              {t('summary.suggestion_generate', '建议生成')}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={[
          styles.btn,
          {
            backgroundColor: 'transparent',
            borderColor: colors.borderControl
          }
        ]}
        onPress={onGenerate}
        activeOpacity={0.8}
      >
        <Text style={[styles.btnIcon, { color: colors.textPrimary }]}>✨</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: sharedTokens.radius.lg,
    padding: sharedTokens.spacing.mdTight,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sharedTokens.spacing.md
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: sharedTokens.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: sharedTokens.spacing.md
  },
  calendarIcon: {
    fontSize: iconSizes.md
  },
  content: {
    flex: 1,
    justifyContent: 'center'
  },
  title: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.xs
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  date: {
    fontSize: mobileTypography.caption.fontSize,
    marginRight: sharedTokens.spacing.sm
  },
  suggestionBadge: {
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.md
  },
  suggestionText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: sharedTokens.spacing.mdTight
  },
  btnIcon: {
    fontSize: mobileTypography.primary.fontSize
  }
})
