import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  isMcpClientTimeoutMessage,
  resolveMcpClientCardStatusKind,
  type McpClientListedTool,
  type McpClientProbeReason,
  type McpClientServerEntry,
  type McpClientServerStatus
} from '@baishou/shared'
import {
  Button,
  Input,
  SettingsGroupCard,
  SettingsItem,
  Switch,
  settingsCardStyles,
  useNativeTheme
} from '@baishou/ui/native'
import { parseMcpClientUrl } from '../../../services/mobile-mcp-client-servers.util'

export function McpClientServerCard({
  server,
  status,
  expanded,
  loadingStatuses,
  testing,
  onToggleExpand,
  onViewTools,
  onDraftUrl,
  onCommitUrl,
  onInvalidUrl,
  onDraftToken,
  onCommitToken,
  onToggleEnabled,
  onRetry,
  onDelete
}: {
  server: McpClientServerEntry
  status?: McpClientServerStatus
  expanded: boolean
  loadingStatuses: boolean
  testing: boolean
  onToggleExpand: () => void
  onViewTools: (tools: McpClientListedTool[]) => void
  onDraftUrl: (url: string) => void
  onCommitUrl: (url: string) => void
  onInvalidUrl: (reason: McpClientProbeReason) => void
  onDraftToken: (authToken: string) => void
  onCommitToken: (authToken: string) => void
  onToggleEnabled: (enabled: boolean) => void
  onRetry: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const tools = status?.tools ?? []
  const connected = Boolean(status?.connected)
  const timedOut = status?.reason === 'timeout' || isMcpClientTimeoutMessage(status?.error)
  const cardStatus = resolveMcpClientCardStatusKind({
    enabled: server.enabled,
    connected,
    loading: loadingStatuses && !connected,
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

  return (
    <SettingsGroupCard>
      <SettingsItem
        title={server.name}
        subtitle={subtitle}
        onPress={onToggleExpand}
        style={{ paddingHorizontal: 0, backgroundColor: colors.bgSurface }}
        rightElement={
          <View
            style={{
              width: tokens.spacing.sm,
              height: tokens.spacing.sm,
              borderRadius: tokens.radius.full,
              backgroundColor: statusColor
            }}
          />
        }
      />
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: tokens.spacing.sm,
          marginTop: tokens.spacing.sm
        }}
      >
        <Button
          variant="outlined"
          disabled={!connected || tools.length === 0}
          onPress={() => onViewTools(tools)}
        >
          {t('settings.mcp_custom_view_tools', '查看工具')}
        </Button>
      </View>
      {expanded ? (
        <View style={{ marginTop: tokens.spacing.md, gap: tokens.spacing.md }}>
          <Input
            label={t('settings.mcp_custom_url', '/mcp 地址')}
            value={server.url}
            onChangeText={onDraftUrl}
            onBlur={() => {
              const parsed = parseMcpClientUrl(server.url)
              if ('error' in parsed) {
                onInvalidUrl(parsed.error)
                return
              }
              onCommitUrl(parsed.url)
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label={t('settings.mcp_custom_token', '访问令牌（可选）')}
            value={server.authToken ?? ''}
            onChangeText={onDraftToken}
            onBlur={() => onCommitToken((server.authToken ?? '').trim())}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
            <Text style={[settingsCardStyles.label, { color: colors.textPrimary, flex: 1 }]}>
              {t('settings.mcp_custom_enable', '启用')}
            </Text>
            <Switch value={server.enabled} onValueChange={onToggleEnabled} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }}>
            <Button variant="outlined" disabled={testing} isLoading={testing} onPress={onRetry}>
              {t('settings.mcp_custom_retry', '重新连接')}
            </Button>
            <Button variant="outlined" destructive onPress={onDelete}>
              {t('common.delete', '删除')}
            </Button>
          </View>
        </View>
      ) : null}
    </SettingsGroupCard>
  )
}
