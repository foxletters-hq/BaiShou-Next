import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';

interface DiaryCardProps {
  id: string;
  contentSnippet: string;
  tags: string[];
  createdAt: Date;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'


export const DiaryCard: React.FC<DiaryCardProps> = ({ 
  contentSnippet, 
  tags, 
  createdAt, 
  onClick,
  onEdit,
  onDelete
}) => {
  const { t } = useTranslation();
  
  const day = createdAt.getDate().toString().padStart(2, '0');
  const month = createdAt.getMonth() + 1;
  const year = createdAt.getFullYear();
  const weekday = [t('common.sunday', '周日'), t('common.monday', '周一'), t('common.tuesday', '周二'), t('common.wednesday', '周三'), t('common.thursday', '周四'), t('common.friday', '周五'), t('common.saturday', '周六')][createdAt.getDay()];

  const getTagColor = (tag: string) => {
    const colors = [
      { bg: 'rgba(33, 150, 243, 0.1)', fg: '#1976D2' },
      { bg: 'rgba(76, 175, 80, 0.1)', fg: '#388E3C' },
      { bg: 'rgba(255, 152, 0, 0.1)', fg: '#F57C00' },
      { bg: 'rgba(156, 39, 176, 0.1)', fg: '#7B1FA2' }
    ];
    let sum = 0;
    for (let i = 0; i < tag.length; i++) sum += tag.charCodeAt(i);
    return colors[sum % colors.length]!;
  };

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onClick}
      activeOpacity={0.9}
    >
      <View style={styles.header}>
        <View style={styles.dateGroup}>
          <Text style={styles.day}>{day}</Text>
          <View style={styles.dateMeta}>
            <Text style={styles.weekday}>{weekday}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{year} · {month}{t('common.month_unit', '月')}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.icon}>📑</Text>
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.snippet} numberOfLines={5}>{contentSnippet}</Text>
        {/* RN LinearGradient mask typically requires react-native-linear-gradient, mock with simple overlap or fade */}
      </View>

      {tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {tags.map(tag => {
            const { bg, fg } = getTagColor(tag);
            return (
              <View key={tag} style={[styles.tag, { backgroundColor: bg }]}>
                <Text style={[styles.tagText, { color: fg }]}>#{tag}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* On Mobile we always show the action buttons according to the original code "Builder isMobile" logic */}
      <View style={styles.actionsDivider} />
      <View style={styles.actionsBox}>
         <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
           <Text style={styles.editText}>✏️ {t('common.edit') || '编辑'}</Text>
         </TouchableOpacity>
         <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
           <Text style={styles.deleteText}>🗑️ {t('common.delete') || '删除'}</Text>
         </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF', // var(--bg-surface)
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)', // var(--divider-color)
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }
    }),
    marginBottom: 24,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  dateGroup: { flexDirection: 'row', alignItems: 'center' },
  day: { fontSize: 32, fontWeight: '800', color: '#1A1A1A', lineHeight: 32 },
  dateMeta: { marginLeft: 12, justifyContent: 'center' },
  weekday: { fontSize: 13, fontWeight: '600', color: '#475569', letterSpacing: 0.5 },
  badge: { 
    marginTop: 4, 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    backgroundColor: 'rgba(91, 168, 245, 0.1)', 
    borderRadius: 4, 
    borderWidth: 0.5, 
    borderColor: 'rgba(91, 168, 245, 0.2)' 
  },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#5BA8F5', letterSpacing: 0.5 },
  icon: { fontSize: 20, opacity: 0.3 },
  contentContainer: { height: 120, overflow: 'hidden' },
  snippet: { fontSize: 15, lineHeight: 24, color: '#1A1A1A', opacity: 0.9 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12, fontWeight: '600' },
  actionsDivider: { height: 1, backgroundColor: 'rgba(148, 163, 184, 0.3)', marginTop: 20, marginBottom: 12 },
  actionsBox: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  editText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  deleteText: { fontSize: 13, fontWeight: '600', color: '#EF4444' }
});
