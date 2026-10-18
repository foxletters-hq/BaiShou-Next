import { useTranslation } from 'react-i18next'
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useNativeTheme } from '../../native/theme'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

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
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('common.app_title', '白守')} · {t('summary.collective_memories_title', '回忆')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('summary.algorithm_desc', '层层沉淀时光印记，凝练日常细节，构建我们共同的记忆脉络。')}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: sharedTokens.radius.lg,
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
    paddingVertical: sharedTokens.spacing.md,
    paddingLeft: sharedTokens.spacing.md,
    paddingRight: sharedTokens.spacing.md
  },
  title: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: mobileTypography.title.fontWeight,
    letterSpacing: -0.3
  },
  subtitle: {
    marginTop: sharedTokens.spacing.xsPlus,
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 19
  }
})
