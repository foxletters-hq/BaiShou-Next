import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNativeTheme } from '../../native/theme';

interface SummaryCardProps {
  id: string;
  title: string;
  dateRange: string;
  summaryText: string;
  type: 'week' | 'month' | 'quarter' | 'year';
  onClick?: () => void;
  onDelete?: () => void;
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
  const { t } = useTranslation();
  const { colors } = useNativeTheme();


  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: colors.bgSurface }]} 
      onPress={onClick} 
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>{t(`summary.type.${type}`)}</Text>
        </View>
        <Text style={[styles.date, { color: colors.textSecondary }]}>{dateRange}</Text>
      </View>
      
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      
      <View style={styles.contentContainer}>
        <Text style={[styles.snippet, { color: colors.textPrimary }]} numberOfLines={7}>{summaryText}</Text>
      </View>

      {onDelete && (
        <View style={styles.actionsBox}>
          <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
             <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginVertical: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }
    }),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  date: { fontSize: 12, opacity: 0.6 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  contentContainer: { height: 150, overflow: 'hidden' },
  snippet: { fontSize: 14, lineHeight: 21, opacity: 0.8 },
  actionsBox: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  actionBtn: { padding: 4 },
  deleteIcon: { fontSize: 16, opacity: 0.5 }
});
