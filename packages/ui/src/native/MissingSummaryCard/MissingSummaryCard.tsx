import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNativeTheme } from '../../native/theme';

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
  const { colors } = useNativeTheme();


  return (
    <View style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }]}>
      <View style={[styles.iconBox, { backgroundColor: colors.warning + '20' }]}>
        <Text style={styles.calendarIcon}>📅</Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{t(`summary.missing_title_${type}`)}</Text>
        <View style={styles.meta}>
          <Text style={[styles.date, { color: colors.textSecondary }]}>{dateRange}</Text>
          <View style={[styles.suggestionBadge, { backgroundColor: colors.warning + '20' }]}>
            <Text style={[styles.suggestionText, { color: colors.warning }]}>{t('summary.suggestion_generate', '建议生成')}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity 
        style={[styles.btn, { backgroundColor: colors.accentPurple + '20' }]} 
        onPress={onGenerate}
        activeOpacity={0.8}
      >
        <Text style={[styles.btnIcon, { color: colors.accentPurple }]}>✨</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  calendarIcon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
    marginRight: 8,
  },
  suggestionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  suggestionText: {
    fontSize: 10,
    fontWeight: '600',
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  btnIcon: {
    fontSize: 16,
  }
});
