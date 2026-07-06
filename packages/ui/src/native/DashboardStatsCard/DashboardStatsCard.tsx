import { useTranslation } from 'react-i18next'
import React from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import type { LucideProps } from 'lucide-react-native'
import {
  BarChart3,
  BookOpen,
  Calendar,
  CalendarRange,
  Columns3,
  LayoutGrid,
  RefreshCw
} from 'lucide-react-native'
import { useNativeTheme } from '../../native/theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'

interface DashboardStatsCardProps {
  totalDiaryCount: number
  totalWeeklyCount: number
  totalMonthlyCount: number
  totalQuarterlyCount: number
  totalYearlyCount: number
  onRescan?: () => void
  rescanning?: boolean
}

const STAT_TILES: Array<{
  icon: React.ComponentType<LucideProps>
  iconColor: string
  bgClass: keyof typeof TILE_BACKGROUNDS
  countColor: string
  labelKey: string
}> = [
  {
    icon: BookOpen,
    iconColor: '#4CAF50',
    bgClass: 'green',
    countColor: '#4caf50',
    labelKey: 'summary.stats_daily'
  },
  {
    icon: Columns3,
    iconColor: '#3F51B5',
    bgClass: 'indigo',
    countColor: '#3f51b5',
    labelKey: 'summary.stats_weekly'
  },
  {
    icon: LayoutGrid,
    iconColor: '#2196F3',
    bgClass: 'blue',
    countColor: '#2196f3',
    labelKey: 'summary.stats_monthly'
  },
  {
    icon: CalendarRange,
    iconColor: '#FBC02D',
    bgClass: 'amber',
    countColor: '#fbc02d',
    labelKey: 'summary.stats_quarterly'
  },
  {
    icon: Calendar,
    iconColor: '#FF9800',
    bgClass: 'orange',
    countColor: '#ff9800',
    labelKey: 'summary.stats_yearly'
  }
]

const TILE_BACKGROUNDS = {
  green: 'rgba(76, 175, 80, 0.08)',
  indigo: 'rgba(63, 81, 181, 0.08)',
  blue: 'rgba(33, 150, 243, 0.08)',
  amber: 'rgba(251, 192, 45, 0.08)',
  orange: 'rgba(255, 152, 0, 0.08)'
} as const

export const DashboardStatsCard: React.FC<DashboardStatsCardProps> = ({
  totalDiaryCount,
  totalWeeklyCount,
  totalMonthlyCount,
  totalQuarterlyCount,
  totalYearlyCount,
  onRescan,
  rescanning = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const cardBorder = colors.borderMuted
  const counts = [
    totalDiaryCount,
    totalWeeklyCount,
    totalMonthlyCount,
    totalQuarterlyCount,
    totalYearlyCount
  ]

  const renderStatTile = (tileIndex: number, fullWidth = false) => {
    const tile = STAT_TILES[tileIndex]!
    const count = counts[tileIndex]!
    const Icon = tile.icon
    return (
      <View
        style={[
          styles.tile,
          fullWidth && styles.tileFull,
          { backgroundColor: TILE_BACKGROUNDS[tile.bgClass] }
        ]}
      >
        <View style={styles.tileIcon}>
          <Icon size={22} color={tile.iconColor} strokeWidth={DEFAULT_STROKE_WIDTH} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.count, { color: tile.countColor }]}>{count}</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t(tile.labelKey)}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: cardBorder }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <BarChart3
            size={20}
            color="#43A047"
            strokeWidth={DEFAULT_STROKE_WIDTH}
            style={styles.headerIcon}
          />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {t('common.app_title')} · {t('summary.stats_panel')}
          </Text>
        </View>
        {onRescan ? (
          <Pressable
            style={[
              styles.rescanButton,
              {
                backgroundColor: colors.bgSurfaceNormal ?? colors.bgSurface,
                opacity: rescanning ? 0.6 : 1
              }
            ]}
            onPress={onRescan}
            disabled={rescanning}
            accessibilityRole="button"
            accessibilityLabel={t('summary.rescan')}
          >
            {rescanning ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <RefreshCw
                size={18}
                color={colors.textSecondary}
                strokeWidth={DEFAULT_STROKE_WIDTH}
              />
            )}
          </Pressable>
        ) : null}
      </View>

      <View style={styles.grid}>
        <View style={styles.row}>
          <View style={styles.cell}>{renderStatTile(0)}</View>
          <View style={styles.spacer} />
          <View style={styles.cell}>{renderStatTile(1)}</View>
        </View>
        <View style={styles.row}>
          <View style={styles.cell}>{renderStatTile(2)}</View>
          <View style={styles.spacer} />
          <View style={styles.cell}>{renderStatTile(3)}</View>
        </View>
        <View style={[styles.row, styles.rowFull]}>
          <View style={styles.cellFull}>{renderStatTile(4, true)}</View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    padding: 20
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0
  },
  headerIcon: {
    marginRight: 8
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    flexShrink: 1
  },
  rescanButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    flexShrink: 0
  },
  grid: {
    gap: 12
  },
  row: {
    flexDirection: 'row'
  },
  rowFull: {
    width: '100%'
  },
  cell: {
    flex: 1
  },
  cellFull: {
    flex: 1,
    width: '100%'
  },
  spacer: {
    width: 12
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12
  },
  tileFull: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch'
  },
  tileIcon: {
    marginRight: 10
  },
  info: {
    justifyContent: 'center'
  },
  count: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  label: {
    fontSize: 11,
    opacity: 0.8
  }
})
