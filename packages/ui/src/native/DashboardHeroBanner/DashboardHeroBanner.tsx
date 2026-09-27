import { useTranslation } from 'react-i18next'
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useNativeTheme } from '../../native/theme'

/** 与桌面 DashboardHeroBanner 一致：卡片式氛围背景 + 柔和文本 + 装饰微光（避免暗色模式大面积刺眼纯蓝） */
export const DashboardHeroBanner: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: isDark ? colors.bgSurfaceRaised : colors.primaryLight,
          borderColor: colors.borderControl,
          borderWidth: 1
        }
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('common.app_title')} · {t('summary.collective_memories_title')}
        </Text>
        <View
          style={[
            styles.tag,
            {
              backgroundColor: isDark ? 'rgba(91, 168, 245, 0.15)' : 'rgba(91, 168, 245, 0.18)',
              borderColor: isDark ? 'rgba(91, 168, 245, 0.3)' : 'rgba(91, 168, 245, 0.25)'
            }
          ]}
        >
          <Text style={[styles.tagText, { color: colors.primary }]}>
            {t('summary.shared_memory', '共同回忆')}
          </Text>
        </View>
      </View>

      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t('summary.algorithm_desc')}
      </Text>

      {/* 纯净单一主色微光，避免多色杂糅发脏 */}
      <View style={[styles.circle, styles.circleAura, { opacity: isDark ? 0.12 : 0.18 }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 120,
    borderRadius: 16,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600'
  },
  subtitle: {
    fontSize: 13,
    marginTop: 8,
    zIndex: 1,
    lineHeight: 18
  },
  circle: {
    position: 'absolute',
    borderRadius: 999
  },
  circleAura: {
    right: -30,
    top: -40,
    width: 180,
    height: 180,
    backgroundColor: 'rgba(91, 168, 245, 0.25)'
  }
})
