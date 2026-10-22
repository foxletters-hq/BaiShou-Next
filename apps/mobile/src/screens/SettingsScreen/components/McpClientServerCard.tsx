import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react-native'
import {
  isMcpClientTimeoutMessage,
  resolveMcpClientCardStatusKind,
  type McpClientListedTool,
  type McpClientProbeReason,
  type McpClientServerEntry,
  type McpClientServerStatus
} from '@baishou/shared'
import { Switch, useSettingsCardStyles, useNativeTheme } from '@baishou/ui/native'
import { settingsTypography } from '@baishou/ui/theme/tokens'

export interface McpClientServerCardProps {
  server: McpClientServerEntry
  status?: McpClientServerStatus
  loadingStatuses?: boolean
  testing?: boolean
  onPress?: () => void
  onToggleEnabled: (enabled: boolean) => void
  expanded?: boolean
  onToggleExpand?: () => void
  onViewTools?: (tools: McpClientListedTool[]) => void
  onDraftUrl?: (url: string) => void
  onCommitUrl?: (url: string) => void
  onInvalidUrl?: (reason: McpClientProbeReason) => void
  onDraftToken?: (authToken: string) => void
  onCommitToken?: (authToken: string) => void
  onRetry?: () => void
  onDelete?: () => void
}

export function McpClientServerCard({
  server,
  status,
  loadingStatuses,
  onPress,
  onToggleExpand,
  onToggleEnabled
}: McpClientServerCardProps) {
  const { t } = useTranslation()
  const { colors, tokens, isDark } = useNativeTheme()
  const cardStyles = useSettingsCardStyles()
  const tools = status?.tools ?? []
  const connected = Boolean(status?.connected)
  const timedOut = status?.reason === 'timeout' || isMcpClientTimeoutMessage(status?.error)
  const cardStatus = resolveMcpClientCardStatusKind({
    enabled: server.enabled,
    connected,
    loading: Boolean(loadingStatuses && !connected),
    timedOut
  })

  const subtitle =
    cardStatus === 'disabled'
      ? t('settings.mcp_custom_disabled', '未启用')
      : cardStatus === 'connected'
        ? t('settings.mcp_custom_tools_enabled', {
            count: tools.length,
            defaultValue: '{{count}} 个工具已启用'
          })
        : cardStatus === 'loading'
          ? t('settings.mcp_custom_tools_loading', '正在获取工具')
          : cardStatus === 'timeout'
            ? t('settings.mcp_custom_tools_timeout', '获取工具超时')
            : t('settings.mcp_custom_disconnected', '未连接')

  const statusColor =
    cardStatus === 'connected'
      ? colors.success
      : cardStatus === 'loading'
        ? colors.primary
        : cardStatus === 'timeout'
          ? colors.warning
          : colors.textTertiary

  const handleCardPress = onPress ?? onToggleExpand

  return (
    <Pressable
      onPress={handleCardPress}
      accessibilityRole="button"
      accessibilityLabel={server.name}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: tokens.spacing.md,
          paddingVertical: tokens.spacing.mdSnug,
          borderRadius: tokens.radius.lg,
          borderWidth: 1,
          borderColor: colors.borderControl,
          backgroundColor: pressed
            ? isDark
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(0, 0, 0, 0.03)'
            : colors.bgSurface,
          gap: tokens.spacing.sm
        }
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: tokens.spacing.xxs }}>
        <Text
          style={[
            cardStyles.label,
            {
              color: colors.textPrimary,
              fontSize: settingsTypography.section.fontSize,
              fontWeight: '600'
            }
          ]}
          numberOfLines={1}
        >
          {server.name}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: tokens.spacing.xs,
            flexWrap: 'wrap'
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: statusColor
            }}
          />
          <Text style={{ fontSize: settingsTypography.meta.fontSize, color: colors.textSecondary }}>
            {subtitle}
          </Text>
          <Text
            style={{
              fontSize: settingsTypography.meta.fontSize,
              color: colors.textTertiary,
              flexShrink: 1
            }}
            numberOfLines={1}
          >
            · {server.url}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.spacing.xs,
          flexShrink: 0
        }}
      >
        <Switch value={server.enabled} onValueChange={onToggleEnabled} />
        <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
      </View>
    </Pressable>
  )
}
