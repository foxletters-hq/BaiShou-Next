import { useTranslation } from 'react-i18next'
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useNativeTheme } from '../../native/theme'

/** 移动端回忆页顶卡：实色表面 + 左侧主色条，不用整块浅底和光晕 */
export const DashboardHeroBanner: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderMuted
        }
      ]}
    >
      <View style={[styles.accent, { backgroundColor: colors.primary }]} />
      <View style={styles.copy}>
        <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>
          {t('common.app_title', '白守')}
        </Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('summary.collective_memories_title', '回忆')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t(
            'summary.algorithm_desc',
            '基于白守级联折叠算法，自动过滤冗余数据，构建我们共同的记忆脉络。'
          )}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 112,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden'
  },
  accent: {
    width: 3,
    alignSelf: 'stretch'
  },
  copy: {
    flex: 1,
    paddingVertical: 18,
    paddingLeft: 16,
    paddingRight: 18
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.4
  },
  title: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 28
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19
  }
})
