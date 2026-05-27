import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export const AboutSettingsPrivacyContent: React.FC = () => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing.lg,
        gap: tokens.spacing.lg
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: '600',
          color: colors.textPrimary
        }}
      >
        {t('settings.development_philosophy', '开发哲学与无痕承诺')}
      </Text>

      <View style={{ gap: tokens.spacing.md }}>
        <View style={{ gap: tokens.spacing.xs }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.textPrimary
            }}
          >
            {t('privacy.data_ownership', '1. 数据主权')}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              lineHeight: 22
            }}
          >
            {t(
              'privacy.data_ownership_desc',
              '白守始终认为，记忆是灵魂的延伸。你的日记数据仅保存在本地 SQLite 数据库中。除了你主动配置的 AI 供应商和云同步目标外，白守不会以任何形式上传你的隐私。'
            )}
          </Text>
        </View>

        <View style={{ gap: tokens.spacing.xs }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.textPrimary
            }}
          >
            {t('privacy.local_first', '2. 本地优先')}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              lineHeight: 22
            }}
          >
            {t(
              'privacy.local_first_desc',
              '即便没有网络，你依然可以流畅地写日记。所有的 AI 总结都是在你发起请求时即时生成的，我们不存储任何生成的文本。'
            )}
          </Text>
        </View>

        <View style={{ gap: tokens.spacing.xs }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.textPrimary
            }}
          >
            {t('privacy.transparency', '3. 透明与安全')}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              lineHeight: 22
            }}
          >
            {t(
              'privacy.transparency_desc',
              '白守支持端到端的数据导出与同步。你可以随时通过 ZIP 导出彻底带走自己的回忆，或者将其同步至你完全掌控的 S3/WebDAV 空间。'
            )}
          </Text>
        </View>
      </View>
    </View>
  )
}
