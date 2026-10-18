import { useTranslation } from 'react-i18next'
import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useNativeTheme } from '../../native/theme'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

interface SummaryCardProps {
  id: string
  title: string
  dateRange: string
  summaryText: string
  type: 'week' | 'month' | 'quarter' | 'year'
  onClick?: () => void
  onDelete?: () => void
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'

export const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  dateRange,
  summaryText,
  type,
  onClick,
  onDelete
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }]}
      onPress={onClick}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>
            {t(`summary.type.${type}`)}
          </Text>
        </View>
        <Text style={[styles.date, { color: colors.textSecondary }]}>{dateRange}</Text>
      </View>

      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>

      <View style={styles.contentContainer}>
        <Text style={[styles.snippet, { color: colors.textPrimary }]} numberOfLines={7}>
          {summaryText}
        </Text>
      </View>

      {onDelete && (
        <View style={styles.actionsBox}>
          <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: sharedTokens.radius.lg,
    padding: sharedTokens.spacing.mdPlus,
    marginHorizontal: sharedTokens.spacing.mdPlus,
    marginVertical: sharedTokens.spacing.sm,
    borderWidth: 1,
    borderStyle: 'solid'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sharedTokens.spacing.mdTight
  },
  badge: {
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.sm
  },
  badgeText: { fontSize: mobileTypography.caption.fontSize, fontWeight: '600' },
  date: { fontSize: mobileTypography.caption.fontSize, opacity: 0.6 },
  title: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.sm
  },
  contentContainer: { height: 150, overflow: 'hidden' },
  snippet: { fontSize: mobileTypography.secondary.fontSize, lineHeight: 21, opacity: 0.8 },
  actionsBox: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: sharedTokens.spacing.md
  },
  actionBtn: { padding: sharedTokens.spacing.xs },
  deleteIcon: { fontSize: mobileTypography.primary.fontSize, opacity: 0.5 }
})
