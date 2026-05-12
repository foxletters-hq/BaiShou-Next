import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNativeTheme } from '../../native/theme';



export const DashboardHeroBanner: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useNativeTheme();

  const greeting = t('dashboard.greeting', '又见面了，今天过得怎样？');

  return (
    <View style={[styles.banner, { backgroundColor: colors.primaryLight }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('common.app_title', '白守')} · {t('summary.collective_memories_title', '回忆')}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('summary.algorithm_desc', '基于白守级联折叠算法，自动过滤冗余数据，构建我们共同的记忆脉络。')}</Text>
      
      <View style={[styles.circle, { right: -20, top: -40, width: 140, height: 140, backgroundColor: colors.accentPink + '33' }]} />
      <View style={[styles.circle, { right: 80, bottom: -30, width: 80, height: 80, backgroundColor: colors.accentBlue + '4D' }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    height: 140,
    borderRadius: 16,
    justifyContent: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    zIndex: 1,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    zIndex: 1,
  },
  circle: {
    position: 'absolute',
    borderRadius: 100,
  }
});
