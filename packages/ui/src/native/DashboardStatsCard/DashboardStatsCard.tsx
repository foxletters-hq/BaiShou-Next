import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DashboardStatsCardProps {
  totalDiaryCount: number;
  totalWeeklyCount: number;
  totalMonthlyCount: number;
  totalQuarterlyCount: number;
  totalYearlyCount: number;
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'


export const DashboardStatsCard: React.FC<DashboardStatsCardProps> = ({
  totalDiaryCount,
  totalWeeklyCount,
  totalMonthlyCount,
  totalQuarterlyCount,
  totalYearlyCount,
}) => {
  const { t } = useTranslation();

  const renderStatTile = (icon: string, count: number, label: string, color: string) => (
    <View style={[styles.tile, { backgroundColor: color + '14' }]}> 
      {/* '14' is roughly hex for 0.08 opacity */}
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.info}>
        <Text style={[styles.count, { color }]}>{count}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>📊</Text>
        <Text style={styles.headerTitle}>
          {t('common.app_title') || '白守'} · {t('summary.stats_panel') || '统计面板'}
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.row}>
          <View style={styles.cell}>{renderStatTile('📘', totalDiaryCount, t('summary.stats_daily') || '日记', '#4CAF50')}</View>
          <View style={styles.spacer} />
          <View style={styles.cell}>{renderStatTile('📅', totalWeeklyCount, t('summary.stats_weekly') || '周统', '#3F51B5')}</View>
        </View>
        <View style={styles.row}>
          <View style={styles.cell}>{renderStatTile('🗂️', totalMonthlyCount, t('summary.stats_monthly') || '月统', '#2196F3')}</View>
          <View style={styles.spacer} />
          <View style={styles.cell}>{renderStatTile('📆', totalQuarterlyCount, t('summary.stats_quarterly') || '季统', '#FFB300')}</View>
        </View>
        <View style={styles.row}>
          <View style={styles.cell}>{renderStatTile('🗓️', totalYearlyCount, t('summary.stats_yearly') || '年统', '#FF9800')}</View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.5)',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  grid: {
    flexDirection: 'column',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
  },
  spacer: {
    width: 12,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  icon: {
    fontSize: 22,
    marginRight: 10,
  },
  info: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  count: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 11,
    color: '#475569',
  }
});
