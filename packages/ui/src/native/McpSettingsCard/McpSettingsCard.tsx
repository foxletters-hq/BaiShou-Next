import React from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Copy, RefreshCw } from 'lucide-react-native'
import type { McpServerConfig } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import { Switch } from '../Switch'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { buildMcpClientJsonExample } from '../../shared/mcp-client-config.util'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'

export interface NativeMcpSettingsCardProps {
  config: McpServerConfig
  mcpEndpointUrl: string
  applying?: boolean
  isRunning?: boolean
  activePort?: number
  onChange: (config: McpServerConfig) => void
  onCopyEndpoint: () => void
  onCopyToken?: () => void
  onRefreshToken?: () => void
}

export const McpSettingsCard: React.FC<NativeMcpSettingsCardProps> = ({
  config,
  mcpEndpointUrl,
  applying = false,
  isRunning = false,
  activePort,
  onChange,
  onCopyEndpoint,
  onCopyToken,
  onRefreshToken
}) => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()

  // 本地状态乐观更新，Switch 按钮交互无延迟响应
  const [localEnabled, setLocalEnabled] = React.useState(config.mcpEnabled)
  const [localApplying, setLocalApplying] = React.useState(applying)

  React.useEffect(() => {
    setLocalEnabled(config.mcpEnabled)
  }, [config.mcpEnabled])

  React.useEffect(() => {
    setLocalApplying(applying)
  }, [applying])

  const handleToggle = (value: boolean) => {
    setLocalEnabled(value)
    if (value) {
      setLocalApplying(true)
    } else {
      setLocalApplying(false)
    }
    // 立即响应外部，使父级 applying 立刻变成 true 触发渐进式两阶段渲染
    onChange({ ...config, mcpEnabled: value })
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

  const subtitle = localEnabled
    ? t('settings.mcp_running', '运行中 · 端口 $port').replace('$port', String(config.mcpPort))
    : t('settings.mcp_desc', '允许外部 AI 通过 MCP 协议调用白守工具')

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
        <View style={[styles.portRow, styles.rowBorder]}>
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

        <View style={[styles.row, styles.col, styles.rowBorder]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('settings.mcp_endpoint', '连接地址')}
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
            <Text style={{ color: colors.textOnPrimary, fontWeight: '600', fontSize: 13 }}>
              {t('settings.mcp_copy_url', '复制 MCP 地址')}
            </Text>
          </Pressable>
          {isRunning && activePort != null ? (
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {t('settings.mcp_running').replace('$port', String(activePort))}
            </Text>
          ) : null}
        </View>

        {config.mcpAuthToken ? (
          <View style={[styles.row, styles.col, styles.rowBorder]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('settings.mcp_auth_token', '访问令牌')}
            </Text>
            <Text style={[styles.mono, { color: colors.primary }]} selectable>
              {config.mcpAuthToken}
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
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 20 }}>
        {t(
          'settings.mcp_help_intro',
          '启用 MCP 后，白守会在本机启动 MCP 服务，供 Cursor 等外部 AI 客户端调用日记、记忆等工具。'
        )}
      </Text>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
          {t('settings.mcp_help_cursor_title', 'Cursor')}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
          1.{' '}
          {t(
            'settings.mcp_help_cursor_1',
            '打开或创建 Cursor 全局配置文件（Windows：%USERPROFILE%\\.cursor\\mcp.json，macOS/Linux：~/.cursor/mcp.json）。'
          )}
          {'\n'}
          2.{' '}
          {t(
            'settings.mcp_help_cursor_2',
            '将下方配置粘贴到 mcpServers 中（url 请使用上方连接地址），保存后重启 Cursor 或刷新 MCP 列表。'
          )}
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
            padding: 8,
            borderRadius: 6,
            color: colors.primary,
            lineHeight: 15,
            marginTop: 4
          }}
        >
          {buildMcpClientJsonExample(mcpEndpointUrl, config.mcpAuthToken)}
        </Text>
      </View>
      <Text style={{ fontSize: 12, color: colors.textTertiary, fontStyle: 'italic', marginTop: 4 }}>
        {t(
          'settings.mcp_help_note',
          '请使用上方 /mcp 地址（不要用 /sse）。启用后需保持白守移动端运行，并确保客户端与手机在同一局域网。'
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
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.titleRow}>
            <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>
              {t('settings.mcp_title', 'MCP Server')}
            </Text>
            <HelpTooltip content={mcpHelpContent} />
          </View>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.block}>
        <View style={[styles.row, styles.rowBorder]}>
          <Text style={[hubStyles.rowTitle, { color: colors.textPrimary, flex: 1 }]}>
            {t('settings.mcp_enable', '启用 MCP 服务')}
          </Text>
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
    borderRadius: 12,
    overflow: 'hidden'
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  block: {
    gap: 0,
    paddingHorizontal: 14,
    paddingBottom: 4
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)'
  },
  col: {
    flexDirection: 'column',
    alignItems: 'flex-start'
  },
  label: {
    fontSize: 13
  },
  sub: {
    fontSize: 13,
    lineHeight: 18
  },
  portRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12
  },
  portInput: {
    width: 100,
    fontSize: 14,
    textAlign: 'center'
  },
  mono: {
    fontSize: 13,
    fontFamily: 'monospace',
    marginTop: 4
  },
  copyBtn: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  tokenActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8
  },
  iconBtn: {
    padding: 8,
    borderRadius: 8
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
    gap: 8,
    zIndex: 1
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500'
  }
})
