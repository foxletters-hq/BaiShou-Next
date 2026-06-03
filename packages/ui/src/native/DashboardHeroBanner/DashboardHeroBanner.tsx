import { useTranslation } from 'react-i18next'
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useNativeTheme } from '../../native/theme'

/** 与桌面 DashboardHeroBanner 一致：主色底 + 白字 + 装饰渐变球 */
export const DashboardHeroBanner: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: colors.primary }
      ]}
    >
      <Text style={styles.title}>
        {t('common.app_title')} · {t('summary.collective_memories_title')}
      </Text>
      <Text style={styles.subtitle}>{t('summary.algorithm_desc')}</Text>

      <View style={[styles.circle, styles.circlePink]} />
      <View style={[styles.circle, styles.circleBlue]} />
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    height: 140,
    borderRadius: 20,
    justifyContent: 'center',
    paddingHorizontal: 28,
    overflow: 'hidden'
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    zIndex: 1,
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    zIndex: 1,
    lineHeight: 18
  },
  circle: {
    position: 'absolute',
    borderRadius: 999
  },
  circlePink: {
    right: -20,
    top: -40,
    width: 140,
    height: 140,
    backgroundColor: 'rgba(255, 154, 158, 0.2)'
  },
  circleBlue: {
    right: 80,
    bottom: -30,
    width: 80,
    height: 80,
    backgroundColor: 'rgba(161, 196, 253, 0.3)'
  }
})
