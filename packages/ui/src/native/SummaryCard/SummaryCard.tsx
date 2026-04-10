import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';

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


  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onClick} 
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t(`summary.type.${type}`)}</Text>
        </View>
        <Text style={styles.date}>{dateRange}</Text>
      </View>
      
      <Text style={styles.title}>{title}</Text>
      
      <View style={styles.contentContainer}>
        <Text style={styles.snippet} numberOfLines={7}>{summaryText}</Text>
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
    backgroundColor: 'var(--bg-surface)', // var(--bg-surface)
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginVertical: 8,
    ...Platform.select({
      ios: { shadowColor: 'var(--text-primary)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }
    }),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: {
    backgroundColor: 'rgba(91, 168, 245, 0.1)', // primary.withOpacity(0.1)
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontWeight: 'bold', color: '#5BA8F5' },
  date: { fontSize: 12, color: 'var(--text-secondary)', opacity: 0.6 },
  title: { fontSize: 18, fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 8 },
  contentContainer: { height: 150, overflow: 'hidden' },
  snippet: { fontSize: 14, lineHeight: 21, color: 'var(--text-primary)', opacity: 0.8 },
  actionsBox: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  actionBtn: { padding: 4 },
  deleteIcon: { fontSize: 16, opacity: 0.5 }
});
