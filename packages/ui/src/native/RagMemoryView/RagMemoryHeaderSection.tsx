import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { isStartupEmbedReminderEnabled } from '@baishou/shared'
import { mobileTypography } from '../../theme/tokens'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { Button } from '../Button'
import { modalActionsStyle } from '../Modal/Modal'
import type { RagConfig, RagStats } from './rag-memory.types'

interface RagMemoryHeaderSectionProps {
  config: RagConfig
  stats: RagStats
  onChange: (config: RagConfig) => void
  onClearAll?: () => Promise<void>
  /** 记忆中心不展示启用开关：嵌入配好就默认使用 */
  showEnableSwitch?: boolean
}

export const RagMemoryHeaderSection: React.FC<RagMemoryHeaderSectionProps> = ({
  config,
  stats,
  onChange,
  onClearAll,
  showEnableSwitch = true
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <View>
      {showEnableSwitch ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: mobileTypography.primary.fontSize,
                fontWeight: mobileTypography.primary.fontWeight
              }}
            >
              {t('agent.rag.title')}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                marginTop: tokens.spacing.xs,
                fontSize: mobileTypography.secondary.fontSize,
                fontWeight: mobileTypography.secondary.fontWeight
              }}
            >
              {t('settings.tooltip_rag_management')}
            </Text>
          </View>
          <Switch
            value={config.ragEnabled}
            onValueChange={(v) => onChange({ ...config, ragEnabled: v })}
          />
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.spacing.sm,
          marginTop: showEnableSwitch ? tokens.spacing.md : 0
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: mobileTypography.primary.fontSize,
              fontWeight: mobileTypography.primary.fontWeight
            }}
          >
            {t('settings.rag_startup_embed_reminder', '启动时检查待嵌入')}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              marginTop: tokens.spacing.xs,
              fontSize: mobileTypography.secondary.fontSize,
              fontWeight: mobileTypography.secondary.fontWeight
            }}
          >
            {t(
              'settings.rag_startup_embed_reminder_hint',
              '启动后如果还有未嵌入的内容，会提示你去补齐。关闭后不再自动弹出。'
            )}
          </Text>
        </View>
        <Switch
          value={isStartupEmbedReminderEnabled(config)}
          onValueChange={(v) => onChange({ ...config, startupEmbedReminder: v })}
        />
      </View>

      {stats.totalCount > 0 && onClearAll ? (
        <View style={[modalActionsStyle, { marginTop: tokens.spacing.md }]}>
          <Button variant="outlined" size="sm" destructive onPress={() => void onClearAll()}>
            {t('settings.rag_clear_all')}
          </Button>
        </View>
      ) : null}
    </View>
  )
}
