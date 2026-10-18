import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export const CompressionDivider: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View
      style={styles.root}
      accessibilityRole="text"
      accessibilityLabel={t('agent.chat.compression_divider_aria', '对话已压缩')}
    >
      <View style={[styles.line, { backgroundColor: colors.borderSubtle }]} />
      <Text
        style={[styles.label, { color: colors.textSecondary, borderColor: colors.borderSubtle }]}
      >
        {t('agent.chat.compression_divider', '对话已压缩')}
      </Text>
      <View style={[styles.line, { backgroundColor: colors.borderSubtle }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight,
    width: '100%',
    marginVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.xs
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    minWidth: 24
  },
  label: {
    flexShrink: 0,
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500',
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden'
  }
})
