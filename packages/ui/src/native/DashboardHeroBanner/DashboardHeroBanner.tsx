import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';



export const DashboardHeroBanner: React.FC = () => {
  const { t } = useTranslation();

  const greeting = t('dashboard.greeting', '又见面了，今天过得怎样？');

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>{t('common.app_title', '白守')} · {t('summary.collective_memories_title', '回忆')}</Text>
      <Text style={styles.subtitle}>{t('summary.algorithm_desc', '基于白守级联折叠算法，自动过滤冗余数据，构建我们共同的记忆脉络。')}</Text>
      
      <View style={[styles.circle, { right: -20, top: -40, width: 140, height: 140, backgroundColor: 'rgba(255,154,158,0.2)' }]} />
      <View style={[styles.circle, { right: 80, bottom: -30, width: 80, height: 80, backgroundColor: 'rgba(161,196,253,0.3)' }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    height: 140,
    backgroundColor: 'rgba(91, 168, 245, 0.2)',
    borderRadius: 16,
    justifyContent: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    zIndex: 1,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginTop: 8,
    zIndex: 1,
  },
  circle: {
    position: 'absolute',
    borderRadius: 100,
  }
});
