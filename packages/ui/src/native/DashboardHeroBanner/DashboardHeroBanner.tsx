import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const DashboardHeroBanner: React.FC = () => {
  const { t } = useTranslation();
  const greeting = "又见面了，今天过得怎样？";

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>{t('summary.dashboard_greeting_morning') || greeting}</Text>
      <Text style={styles.subtitle}>{t('summary.dashboard_subtitle') || '过去的日子都在这里闪闪发光'}</Text>
      
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
    color: '#1A1A1A',
    zIndex: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    marginTop: 8,
    zIndex: 1,
  },
  circle: {
    position: 'absolute',
    borderRadius: 100,
  }
});
