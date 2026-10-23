import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { mobileTypography } from '../../theme/tokens'

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
          fontSize: mobileTypography.title.fontSize,
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
              fontSize: mobileTypography.primary.fontSize,
              fontWeight: '600',
              color: colors.textPrimary
            }}
          >
            {t('privacy.data_ownership', '1. 数据主权')}
          </Text>
          <Text
            style={{
              fontSize: mobileTypography.secondary.fontSize,
              color: colors.textSecondary,
              lineHeight: 22
            }}
          >
            {t(
              'privacy.data_ownership_desc',
              '白守始终认为，记忆是灵魂的延伸。你的日记以纯文本 Markdown 及附件形式完整保存在本地工作区（Vault）中，格式开放、永远属于你；本地 SQLite 仅作为影子索引与检索缓存，即使清空也可随时从文件安全重建。除你主动配置的模型服务与云同步目标外，白守绝不收集或上传你的任何数据。'
            )}
          </Text>
        </View>

        <View style={{ gap: tokens.spacing.xs }}>
          <Text
            style={{
              fontSize: mobileTypography.primary.fontSize,
              fontWeight: '600',
              color: colors.textPrimary
            }}
          >
            {t('privacy.local_first', '2. 本地优先')}
          </Text>
          <Text
            style={{
              fontSize: mobileTypography.secondary.fontSize,
              color: colors.textSecondary,
              lineHeight: 22
            }}
          >
            {t(
              'privacy.local_first_desc',
              '即便在离线断网环境下，你依然可以丝滑书写日记。所有的 AI 伙伴交互与记忆总结均由你按需主动发起，直连你配置的模型服务商或本地离线大模型。白守不设任何中心化中转服务器，记录与生成内容全部保存在本地，绝不被挪用于模型训练。'
            )}
          </Text>
        </View>

        <View style={{ gap: tokens.spacing.xs }}>
          <Text
            style={{
              fontSize: mobileTypography.primary.fontSize,
              fontWeight: '600',
              color: colors.textPrimary
            }}
          >
            {t('privacy.transparency', '3. 透明与安全')}
          </Text>
          <Text
            style={{
              fontSize: mobileTypography.secondary.fontSize,
              color: colors.textSecondary,
              lineHeight: 22
            }}
          >
            {t(
              'privacy.transparency_desc',
              '白守支持多设备双向增量云同步与全量快照备份。你可以将工作区安全同步至完全掌控的 WebDAV（如 NAS、坚果云）或 S3 兼容对象存储（如 Cloudflare R2、MinIO），桌面端亦支持 Git 版本管理。你也可随时通过 ZIP 一键导出带走全部回忆，实现真正的端到端自主掌控。'
            )}
          </Text>
        </View>
      </View>
    </View>
  )
}
