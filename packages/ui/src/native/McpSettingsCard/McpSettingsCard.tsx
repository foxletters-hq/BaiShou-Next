import React from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Copy, RefreshCw } from 'lucide-react-native'
import type { McpServerConfig } from '@baishou/shared'
import { isMcpAuthEnabled } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import { Switch } from '../Switch'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { buildMcpClientJsonExample } from '../../shared/mcp-client-config.util'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface NativeMcpSettingsCardProps {
  config: McpServerConfig
  mcpEndpointUrl: string
  mcpSseEndpointUrl?: string
  applying?: boolean
  isRunning?: boolean
  activePort?: number
  onChange: (config: McpServerConfig) => void
  onCopyEndpoint: () => void
  onCopySseEndpoint?: () => void
  onCopyToken?: () => void
  onRefreshToken?: () => void
}

export const McpSettingsCard: React.FC<NativeMcpSettingsCardProps> = ({
  config,
  mcpEndpointUrl,
  mcpSseEndpointUrl,
  applying = false,
  isRunning = false,
  activePort,
  onChange,
  onCopyEndpoint,
  onCopySseEndpoint,
  onCopyToken,
  onRefreshToken
}) => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()

  const [localEnabled, setLocalEnabled] = React.useState(config.mcpEnabled)
  const [localApplying, setLocalApplying] = React.useState(applying)
  const authEnabled = isMcpAuthEnabled(config)
  const authTokenForUi = authEnabled ? config.mcpAuthToken : undefined

  React.useEffect(() => {
    setLocalEnabled(config.mcpEnabled)
  }, [config.mcpEnabled])

  React.useEffect(() => {
    setLocalApplying(applying)
  }, [applying])

  const handleToggle = (value: boolean) => {
    setLocalEnabled(value)
    setLocalApplying(value)
    onChange({ ...config, mcpEnabled: value })
  }

  const handleToggleAuth = (value: boolean) => {
    onChange({ ...config, mcpAuthEnabled: value })
  }

  const handleRefreshToken = () => {
    if (!onRefreshToken) return
    Alert.alert(
      t('settings.mcp_refresh_token_title', '刷新访问令牌'),
      t(
        'settings.mcp_refresh_token_message',
        '刷新后旧令牌将立即失效，已配置的外部客户端需要更新 Authorization 头。确定要继续吗？'
      ),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('settings.mcp_refresh_token_confirm', '刷新令牌'),
          style: 'destructive',
          onPress: onRefreshToken
        }
      ]
    )
  }

  const displayPort = activePort ?? config.mcpPort
  const subtitle = localEnabled
    ? localApplying
      ? t('settings.mcp_starting', '正在启停服务...')
      : isRunning
        ? t('settings.mcp_running', '运行中 · 端口 $port').replace('$port', String(displayPort))
        : t('settings.mcp_stopped', '已停止')
    : t('settings.mcp_desc', '允许外部 AI 通过 MCP 协议调用白守工具')

  const effectiveToken = authEnabled ? config.mcpAuthToken : undefined

  const connectionPanel = (
    <View style={styles.panel}>
      {localApplying ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('settings.mcp_starting', '正在启停服务...')}
          </Text>
        </View>
      ) : null}

      <View
        style={localApplying ? styles.panelDimmed : undefined}
        pointerEvents={localApplying ? 'none' : 'auto'}
      >
        <View style={[styles.portRow, styles.rowBorder, { borderTopColor: colors.borderMuted }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('settings.mcp_port', '端口')}
          </Text>
          <Input
            style={styles.portInput}
            keyboardType="number-pad"
            value={String(config.mcpPort)}
            onChangeText={(text) => {
              const val = parseInt(text, 10)
              if (!isNaN(val)) onChange({ ...config, mcpPort: val })
            }}
            onBlur={() => {
              const port = Math.min(65535, Math.max(1000, config.mcpPort || 31004))
              onChange({ ...config, mcpPort: port })
            }}
          />
        </View>

        <View
          style={[
            styles.row,
            styles.tokenBody,
            styles.rowBorder,
            { borderTopColor: colors.borderMuted }
          ]}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('settings.mcp_url_label', '连接地址（推荐）')}
          </Text>
          <Text style={[styles.mono, { color: colors.primary }]} selectable>
            {mcpEndpointUrl}
          </Text>
          <Pressable
            onPress={onCopyEndpoint}
            style={({ pressed }) => [
              styles.copyBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }
            ]}
          >
            <Text
              style={{
                color: colors.textOnPrimary,
                fontWeight: '600',
                fontSize: mobileTypography.secondary.fontSize
              }}
            >
              {t('settings.mcp_copy_url', '复制 MCP 地址')}
            </Text>
          </Pressable>
          {mcpSseEndpointUrl ? (
            <>
              <Text
                style={[
                  styles.label,
                  { color: colors.textSecondary, marginTop: sharedTokens.spacing.smPlus }
                ]}
              >
                {t('settings.mcp_sse_label', '连接地址（SSE）')}
              </Text>
              <Text style={[styles.mono, { color: colors.primary }]} selectable>
                {mcpSseEndpointUrl}
              </Text>
              {onCopySseEndpoint ? (
                <Pressable
                  onPress={onCopySseEndpoint}
                  style={({ pressed }) => [
                    styles.copyBtn,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }
                  ]}
                >
                  <Text
                    style={{
                      color: colors.textOnPrimary,
                      fontWeight: '600',
                      fontSize: mobileTypography.secondary.fontSize
                    }}
                  >
                    {t('settings.mcp_copy_sse_url', '复制 SSE 地址')}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
          {isRunning && activePort != null ? (
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {t('settings.mcp_running', '运行中 · 端口 $port').replace(
                '$port',
                String(activePort)
              )}
            </Text>
          ) : null}
        </View>

        <View style={[styles.row, styles.rowBorder, { borderTopColor: colors.borderMuted }]}>
          <View style={[styles.titleRow, { flex: 1 }]}>
            <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>
              {t('settings.mcp_auth_enable', '启用鉴权')}
            </Text>
            <HelpTooltip
              content={t('settings.mcp_auth_enable_desc', '开启后外部客户端需携带访问令牌')}
            />
          </View>
          <Switch value={authEnabled} onValueChange={handleToggleAuth} />
        </View>

        {authEnabled && authTokenForUi ? (
          <View
            style={[styles.tokenBody, styles.rowBorder, { borderTopColor: colors.borderMuted }]}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('settings.mcp_auth_token', '访问令牌')}
            </Text>
            <Text style={[styles.mono, { color: colors.primary }]} selectable>
              {authTokenForUi}
            </Text>
            <View style={styles.tokenActions}>
              {onRefreshToken ? (
                <Pressable
                  onPress={handleRefreshToken}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: colors.bgApp, opacity: pressed ? 0.7 : 1 }
                  ]}
                  accessibilityLabel={t('settings.mcp_refresh_token', '刷新访问令牌')}
                >
                  <RefreshCw
                    size={20}
                    color={colors.textSecondary}
                    strokeWidth={DEFAULT_STROKE_WIDTH}
                  />
                </Pressable>
              ) : null}
              {onCopyToken ? (
                <Pressable
                  onPress={onCopyToken}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: colors.bgApp, opacity: pressed ? 0.7 : 1 }
                  ]}
                  accessibilityLabel={t('settings.mcp_copy_token', '复制访问令牌')}
                >
                  <Copy size={18} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )

  const mcpHelpContent = (
    <View style={{ gap: sharedTokens.spacing.mdTight }}>
      <Text
        style={{
          fontSize: mobileTypography.secondary.fontSize,
          color: colors.textPrimary,
          lineHeight: 20
        }}
      >
        {t(
          'settings.mcp_help_intro',
          '启用 MCP 后，白守会在本机启动 MCP 服务，供 Cursor 等外部 AI 客户端调用日记、记忆等工具。'
        )}
      </Text>
      <View style={{ gap: sharedTokens.spacing.xs }}>
        <Text
          style={{
            fontSize: mobileTypography.secondary.fontSize,
            fontWeight: '600',
            color: colors.textPrimary
          }}
        >
          {t('settings.mcp_help_cursor_title', 'Cursor')}
        </Text>
        <Text
          style={{
            fontSize: mobileTypography.secondary.fontSize,
            color: colors.textSecondary,
            lineHeight: 18
          }}
        >
          1.{' '}
          {t(
            'settings.mcp_help_cursor_1',
            '打开或创建 Cursor 全局配置文件（Windows：%USERPROFILE%\\.cursor\\mcp.json，macOS/Linux：~/.cursor/mcp.json）。'
          )}
          {'\n'}
          2.{' '}
          {t(
            'settings.mcp_help_cursor_2',
            '将下方配置粘贴到 mcpServers 中（推荐 /mcp；若客户端仅支持旧版 SSE，改用 /sse），保存后重启 Cursor 或刷新 MCP 列表。'
          )}
        </Text>
        <Text
          style={{
            fontSize: mobileTypography.caption.fontSize,
            fontWeight: '600',
            color: colors.textSecondary,
            marginTop: sharedTokens.spacing.xsPlus
          }}
        >
          {t('settings.mcp_help_streamable_title', '推荐：Streamable HTTP（/mcp）')}
        </Text>
        <Text
          style={{
            fontSize: mobileTypography.caption.fontSize,
            fontFamily: 'monospace',
            backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
            padding: sharedTokens.spacing.sm,
            borderRadius: sharedTokens.radius.xsPlus,
            color: colors.primary,
            lineHeight: 15
          }}
        >
          {buildMcpClientJsonExample(mcpEndpointUrl, authTokenForUi, 'streamableHttp')}
        </Text>
        {mcpSseEndpointUrl ? (
          <>
            <Text
              style={{
                fontSize: mobileTypography.caption.fontSize,
                fontWeight: '600',
                color: colors.textSecondary,
                marginTop: sharedTokens.spacing.xsPlus
              }}
            >
              {t('settings.mcp_help_sse_title', '兼容：SSE（/sse）')}
            </Text>
            <Text
              style={{
                fontSize: mobileTypography.caption.fontSize,
                fontFamily: 'monospace',
                backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                padding: sharedTokens.spacing.sm,
                borderRadius: sharedTokens.radius.xsPlus,
                color: colors.primary,
                lineHeight: 15,
                marginTop: sharedTokens.spacing.xs
              }}
            >
              {buildMcpClientJsonExample(mcpSseEndpointUrl, effectiveToken)}
            </Text>
          </>
        ) : null}
      </View>
      <Text
        style={{
          fontSize: mobileTypography.caption.fontSize,
          color: colors.textTertiary,
          fontStyle: 'italic',
          marginTop: sharedTokens.spacing.xs
        }}
      >
        {authEnabled
          ? t(
              'settings.mcp_help_note',
              '优先使用 /mcp；仅当客户端不支持 Streamable HTTP 时改用 /sse。启用后需保持白守移动端运行，并确保客户端与手机在同一局域网。'
            )
          : t(
              'settings.mcp_help_auth_disabled_note',
              '当前已关闭鉴权，配置中无需 Authorization 头。仅建议在受信网络使用。'
            )}
      </Text>
    </View>
  )

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.borderSubtle,
          backgroundColor: colors.bgSurface
        }
      ]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, gap: sharedTokens.spacing.xs }}>
          <View style={styles.titleRow}>
            <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>
              {t('settings.mcp_title', 'MCP 服务')}
            </Text>
            <HelpTooltip content={mcpHelpContent} />
          </View>
          {localEnabled ? (
            <Text style={[styles.sub, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.block}>
        <View style={[styles.row, styles.rowBorder, { borderTopColor: colors.borderMuted }]}>
          <View style={[styles.titleRow, { flex: 1 }]}>
            <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>
              {t('settings.mcp_enable', '启用 MCP 服务')}
            </Text>
            <HelpTooltip
              content={t('settings.mcp_desc', '允许外部 AI 通过 MCP 协议调用白守工具')}
            />
          </View>
          <Switch value={localEnabled} onValueChange={handleToggle} />
        </View>
        {connectionPanel}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: sharedTokens.radius.md,
    overflow: 'hidden'
  },
  header: {
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingTop: sharedTokens.spacing.mdTight,
    paddingBottom: sharedTokens.spacing.sm
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  block: {
    gap: 0,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingBottom: sharedTokens.spacing.xs
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.sm
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth
  },
  tokenBody: { flexDirection: 'column', alignItems: 'flex-start' },
  label: {
    fontSize: mobileTypography.secondary.fontSize
  },
  sub: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18
  },
  portRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.mdTight
  },
  portInput: {
    width: 100,
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center'
  },
  mono: {
    fontSize: mobileTypography.secondary.fontSize,
    fontFamily: 'monospace',
    marginTop: sharedTokens.spacing.xs
  },
  copyBtn: {
    marginTop: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm
  },
  tokenActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    marginTop: sharedTokens.spacing.sm
  },
  iconBtn: {
    padding: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm
  },
  panel: {
    position: 'relative'
  },
  panelDimmed: {
    opacity: 0.45
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.sm,
    zIndex: 1
  },
  loadingText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  }
})
