import { useTranslation } from 'react-i18next'
import React from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'
import { StatisticCard } from '../StatisticCard'
import { iconSizes, mobileTypography, sharedTokens } from '../../theme/tokens'

export interface SummaryDashboardProps {
  diaryCount: number
  summaryCount: number
  streakDays: number
  totalWords: number
  weeklySummary?: any
  monthlySummary?: any
  onNavigateToDetail?: (id: string) => void
}

interface RecentSummary {
  id: string
  title: string
  date: string
  type: 'weekly' | 'monthly'
}

export const SummaryDashboard: React.FC<SummaryDashboardProps> = ({
  diaryCount,
  summaryCount,
  streakDays,
  totalWords,
  weeklySummary,
  monthlySummary,
  onNavigateToDetail
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const recentSummaries: RecentSummary[] = []
  if (weeklySummary) {
    recentSummaries.push({
      id: 'weekly',
      title: t('summary.weekly', '周总结'),
      date: weeklySummary.date || '',
      type: 'weekly'
    })
  }
  if (monthlySummary) {
    recentSummaries.push({
      id: 'monthly',
      title: t('summary.monthly', '月总结'),
      date: monthlySummary.date || '',
      type: 'monthly'
    })
  }

  const formatWordCount = (count: number): string => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
    return count.toLocaleString()
  }

  const renderSummaryItem = ({ item }: { item: RecentSummary }) => (
    <TouchableOpacity
      style={[
        styles.summaryItem,
        {
          backgroundColor: colors.bgSurfaceNormal,
          borderColor: colors.borderSubtle,
          borderRadius: tokens.radius.xs
        }
      ]}
      onPress={() => onNavigateToDetail?.(item.id)}
      activeOpacity={0.7}
      disabled={!onNavigateToDetail}
    >
      <View style={styles.summaryItemLeft}>
        <Text style={styles.summaryItemIcon}>{item.type === 'weekly' ? '📅' : '📆'}</Text>
        <View>
          <Text style={[styles.summaryItemTitle, { color: colors.textPrimary }]}>{item.title}</Text>
          <Text style={[styles.summaryItemDate, { color: colors.textTertiary }]}>{item.date}</Text>
        </View>
      </View>
      <Text style={[styles.summaryArrow, { color: colors.textTertiary }]}>→</Text>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <Text style={[styles.dashboardTitle, { color: colors.textPrimary }]}>
        📊 {t('summary.dashboard_title', '数据概览')}
      </Text>

      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <View style={styles.statsCell}>
            <StatisticCard
              title={t('summary.stats_total_diaries', '日记数')}
              value={diaryCount}
              icon="📘"
            />
          </View>
          <View style={styles.statsGap} />
          <View style={styles.statsCell}>
            <StatisticCard
              title={t('summary.stats_total_summaries', '总结数')}
              value={summaryCount}
              icon="📝"
            />
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statsCell}>
            <StatisticCard
              title={t('summary.stats_streak', '连续天数')}
              value={streakDays}
              icon="🔥"
              trend={streakDays > 7 ? 'up' : 'neutral'}
              trendValue={streakDays > 7 ? `+${streakDays - 7}` : undefined}
            />
          </View>
          <View style={styles.statsGap} />
          <View style={styles.statsCell}>
            <StatisticCard
              title={t('summary.stats_words', '总字数')}
              value={formatWordCount(totalWords)}
              icon="✍️"
            />
          </View>
        </View>
      </View>

      {recentSummaries.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('summary.recent', '最近总结')}
          </Text>
          <FlatList
            data={recentSummaries}
            keyExtractor={(item) => item.id}
            renderItem={renderSummaryItem}
            scrollEnabled={false}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  dashboardTitle: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.md
  },
  statsGrid: {
    marginBottom: sharedTokens.spacing.mdPlus
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: sharedTokens.spacing.mdTight
  },
  statsCell: {
    flex: 1
  },
  statsGap: {
    width: 12
  },
  recentSection: {
    marginTop: sharedTokens.spacing.xs
  },
  sectionTitle: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.smPlus
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: sharedTokens.spacing.mdSnug,
    borderWidth: 1,
    marginBottom: sharedTokens.spacing.sm
  },
  summaryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  summaryItemIcon: {
    fontSize: iconSizes.md,
    marginRight: sharedTokens.spacing.mdTight
  },
  summaryItemTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  summaryItemDate: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xxs
  },
  summaryArrow: {
    fontSize: mobileTypography.primary.fontSize
  }
})
