import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import type { NativeAboutSettingsCardProps } from './about-settings.types'

export const AboutSettingsCard: React.FC<NativeAboutSettingsCardProps> = ({
  onNavigateAbout,
  onNavigatePrivacy,
  onOpenFeedback,
  embedded = false
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const rows = [
    {
      key: 'about',
      title: t('settings.about_baishou', '关于白守'),
      onPress: onNavigateAbout,
      trailing: '›'
    },
    {
      key: 'privacy',
      title: t('settings.development_philosophy', '开发哲学与无痕承诺'),
      onPress: onNavigatePrivacy,
      trailing: '›'
    },
    {
      key: 'feedback',
      title: t('settings.feedback', '问题反馈'),
      onPress: onOpenFeedback,
      trailing: '↗'
    }
  ]

  const content = rows.map((row, index) => (
    <Pressable
      key={row.key}
      onPress={row.onPress}
      style={({ pressed }) => [
        styles.row,
        index < rows.length - 1 && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderSubtle
        },
        { opacity: pressed ? 0.7 : 1 }
      ]}
    >
      <Text style={[hubStyles.title, { color: colors.textPrimary, flex: 1 }]}>{row.title}</Text>
      <Text style={[styles.chevron, { color: colors.textTertiary }]}>{row.trailing}</Text>
    </Pressable>
  ))

  if (embedded) {
    return <View>{content}</View>
  }

  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden'
      }}
    >
      {content}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12
  },
  chevron: {
    fontSize: 18,
    lineHeight: 18
  }
})
