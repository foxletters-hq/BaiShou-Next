import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'
import { mobileTypography, settingsIcons, uiTypography, sharedTokens } from '../../theme/tokens'

export interface StatisticCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

const TREND_ICONS: Record<string, string> = {
  up: '▲',
  down: '▼',
  neutral: '—'
}

export const StatisticCard: React.FC<StatisticCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue
}) => {
  const { colors, tokens } = useNativeTheme()

  const trendColor =
    trend === 'up' ? colors.success : trend === 'down' ? colors.error : colors.textTertiary

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: tokens.radius.md
        }
      ]}
    >
      <View style={styles.header}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
      </View>

      <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>

      <View style={styles.footer}>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
        ) : null}
        {trend && trendValue ? (
          <View style={styles.trendRow}>
            <Text style={[styles.trendIcon, { color: trendColor }]}>{TREND_ICONS[trend]}</Text>
            <Text style={[styles.trendValue, { color: trendColor }]}>{trendValue}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: sharedTokens.spacing.md,
    borderWidth: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sharedTokens.spacing.sm
  },
  icon: {
    fontSize: settingsIcons.trailing,
    marginRight: sharedTokens.spacing.sm
  },
  title: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  value: {
    fontSize: mobileTypography.display.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.xsPlus
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  subtitle: {
    fontSize: mobileTypography.caption.fontSize
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  trendIcon: {
    fontSize: uiTypography.sm,
    marginRight: sharedTokens.spacing.xs
  },
  trendValue: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  }
})
