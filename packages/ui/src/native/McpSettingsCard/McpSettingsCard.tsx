import React from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { McpServerConfig } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import { Switch } from '../Switch'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'
import { AnimatedCollapse } from '../settings/AnimatedCollapse'
import { HelpTooltip } from '../Tooltip/HelpTooltip'

export interface NativeMcpSettingsCardProps {
  config: McpServerConfig
  mcpEndpointUrl: string
  applying?: boolean
  isRunning?: boolean
  activePort?: number
  embedded?: boolean
  isLast?: boolean
  onChange: (config: McpServerConfig) => void
  onCopyEndpoint: () => void
  onShowTools: () => void
}

export const McpSettingsCard: React.FC<NativeMcpSettingsCardProps> = ({
  config,
  mcpEndpointUrl,
  applying = false,
  isRunning = false,
  activePort,
  embedded = false,
  isLast = false,
  onChange,
  onCopyEndpoint,
  onShowTools
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

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

  const subtitle = localEnabled
    ? t('settings.mcp_running', '运行中 · 端口 $port').replace('$port', String(config.mcpPort))
    : t('settings.mcp_desc', '允许外部 AI 通过 MCP 协议调用白守工具')

  const isDark =
    colors.textPrimary === '#ffffff' ||
    colors.bgApp === '#000000' ||
    colors.bgApp === '#121212' ||
    colors.bgSurface === '#1e1e1e'

  const mcpHelpContent = (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 20 }}>
        {t(
          'settings.mcp_help_intro',
          '启用 MCP 后，白守会在本机启动 MCP 服务，供 Cursor 调用日记、记忆等工具。'
        )}
      </Text>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
          {t('settings.mcp_help_json_title', 'JSON 配置客户端')}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
          1.{' '}
          {t(
            'settings.mcp_help_json_1',
            '打开 设置 → MCP → 编辑 JSON，在 mcpServers 中新增服务器。'
          )}
          {'\n'}
          2.{' '}
          {t(
            'settings.mcp_help_json_2',
            'type 设为 streamableHttp，baseUrl 设为上方连接地址（必须以 /mcp 结尾）。'
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
          {`{
  "mcpServers": {
    "baishou": {
      "type": "streamableHttp",
      "baseUrl": "${mcpEndpointUrl}"
    }
  }
}`}
        </Text>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
          {t('settings.mcp_help_cursor_title', 'Cursor')}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
          1.{' '}
          {t(
            'settings.mcp_help_cursor_1',
            '打开 Cursor 设置 → Features → MCP（或编辑项目/全局 mcp.json）。'
          )}
          {'\n'}
          2.{' '}
          {t(
            'settings.mcp_help_cursor_2',
            '添加服务器，将 url 设为上方连接地址，保存后重启 Cursor 或刷新 MCP 列表。'
          )}
        </Text>
      </View>
      <Text style={{ fontSize: 12, color: colors.textTertiary, fontStyle: 'italic', marginTop: 4 }}>
        {t(
          'settings.mcp_help_note',
          '请使用上方 /mcp 地址（不要用 /sse）。启用后需保持白守桌面端运行。'
        )}
      </Text>
    </View>
  )

  return (
    <SettingsExpansionTile
      embedded={embedded}
      isLast={isLast}
      title={t('settings.mcp_title', 'MCP Server')}
      titleAddon={<HelpTooltip content={mcpHelpContent} />}
      subtitle={subtitle}
    >
      <View style={styles.block}>
        <View style={styles.row}>
          <Text style={[hubStyles.rowTitle, { color: colors.textPrimary, flex: 1 }]}>
            {t('settings.mcp_enable', '启用 MCP 服务')}
          </Text>
          <Switch value={localEnabled} disabled={applying} onValueChange={handleToggle} />
        </View>

        <AnimatedCollapse expanded={localEnabled}>
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
              <Pressable
                onPress={onShowTools}
                style={({ pressed }) => [styles.row, styles.rowBorder, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>
                    {t('settings.mcp_view_tools', '查看已暴露的工具列表')}
                  </Text>
                  <Text style={[styles.sub, { color: colors.textSecondary }]}>
                    {t('settings.mcp_view_tools_desc')}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
              </Pressable>

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
            </View>
          </View>
        </AnimatedCollapse>
      </View>
    </SettingsExpansionTile>
  )
}

const styles = StyleSheet.create({
  block: {
    gap: 0
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
  chevron: {
    fontSize: 18
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
