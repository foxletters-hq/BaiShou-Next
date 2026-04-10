import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface MissingSummaryCardProps {
  type: 'week' | 'month' | 'quarter' | 'year';
  dateRange: string;
  onGenerate: () => void;
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'


export const MissingSummaryCard: React.FC<MissingSummaryCardProps> = ({ 
  type, 
  dateRange, 
  onGenerate 
}) => {
  const { t } = useTranslation();


  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Text style={styles.calendarIcon}>📅</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{t(`summary.missing_title_${type}`)}</Text>
        <View style={styles.meta}>
          <Text style={styles.date}>{dateRange}</Text>
          <View style={styles.suggestionBadge}>
            <Text style={styles.suggestionText}>{t('summary.suggestion_generate') || '建议生成'}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.btn} 
        onPress={onGenerate}
        activeOpacity={0.8}
      >
        <Text style={styles.btnIcon}>✨</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'var(--bg-surface)', // surface
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    backgroundColor: '#FFF4E5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  calendarIcon: {
    fontSize: 20,
    color: '#F28B50',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginRight: 8,
  },
  suggestionBadge: {
    backgroundColor: '#FFF4E5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  suggestionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F28B50',
  },
  btn: {
    width: 40,
    height: 40,
    backgroundColor: '#F2EFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  btnIcon: {
    fontSize: 16,
    color: '#6C5CE7',
  }
});
