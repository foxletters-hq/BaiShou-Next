import { useTranslation } from 'react-i18next'
import React from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'
import { StatisticCard } from '../StatisticCard'

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
          borderRadius: tokens.radius.sm
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16
  },
  statsGrid: {
    marginBottom: 20
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12
  },
  statsCell: {
    flex: 1
  },
  statsGap: {
    width: 12
  },
  recentSection: {
    marginTop: 4
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    marginBottom: 8
  },
  summaryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  summaryItemIcon: {
    fontSize: 20,
    marginRight: 12
  },
  summaryItemTitle: {
    fontSize: 14,
    fontWeight: '500'
  },
  summaryItemDate: {
    fontSize: 12,
    marginTop: 2
  },
  summaryArrow: {
    fontSize: 16
  }
})
