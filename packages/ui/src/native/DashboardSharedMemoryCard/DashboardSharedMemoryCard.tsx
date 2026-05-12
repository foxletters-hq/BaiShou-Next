import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { useNativeTheme } from '../../native/theme';

interface DashboardSharedMemoryCardProps {
  lookbackMonths: number;
  onMonthsChanged: (val: number) => void;
  onCopyContext: () => void;
}

// TODO: [Agent1-Dependency] 替换


export const DashboardSharedMemoryCard: React.FC<DashboardSharedMemoryCardProps> = ({
  lookbackMonths,
  onMonthsChanged,
  onCopyContext
}) => {
  const { t } = useTranslation();
  const { colors } = useNativeTheme();


  return (
    <View style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }]}>
      <View style={styles.header}>
         <Text style={styles.headerIcon}>🌸</Text>
         <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('summary.shared_memory', '共同回忆')}</Text>
      </View>
      
      <Text style={[styles.desc, { color: colors.textSecondary }]}>
        {t('dashboard.shared_memory_desc', '调整回溯月份，为 RAG 或大语言模型导出近期总结上下文片段。')}
      </Text>

      <View style={styles.controls}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t('dashboard.lookback_months', '回溯 {{count}} 个月', { count: lookbackMonths })}</Text>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={60}
          step={1}
          value={lookbackMonths}
          onValueChange={onMonthsChanged}
          minimumTrackTintColor={colors.accentPink}
          maximumTrackTintColor={colors.borderMuted}
          thumbTintColor={colors.accentPink}
        />
      </View>

      <TouchableOpacity activeOpacity={0.7} style={[styles.btn, { backgroundColor: colors.accentPink }]} onPress={onCopyContext}>
        <Text style={[styles.btnText, { color: colors.textOnPrimary }]}>✨ {t('dashboard.copy_to_ai', 'Copy 给 AI')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  desc: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
  },
  controls: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  btn: {
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  btnText: {
    fontWeight: 'bold',
    fontSize: 14,
  }
});
