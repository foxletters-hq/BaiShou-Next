import React from 'react'
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { McpServerConfig } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'

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

  const subtitle = config.mcpEnabled
    ? t('settings.mcp_running', '运行中 · 端口 $port').replace('$port', String(config.mcpPort))
    : t('settings.mcp_desc', '允许外部 AI 通过 MCP 协议调用白守工具')

  return (
    <SettingsExpansionTile
      embedded={embedded}
      isLast={isLast}
      title={t('settings.mcp_title', 'MCP Server')}
      subtitle={subtitle}
    >
      <View style={styles.block}>
        <View style={styles.row}>
          <Text style={[hubStyles.rowTitle, { color: colors.textPrimary, flex: 1 }]}>
            {t('settings.mcp_enable', '启用 MCP 服务')}
          </Text>
          <Switch
            value={config.mcpEnabled}
            disabled={applying}
            onValueChange={(value) => onChange({ ...config, mcpEnabled: value })}
          />
        </View>

        {config.mcpEnabled ? (
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
        ) : null}

        {config.mcpEnabled ? (
          <>
            <View style={[styles.row, styles.rowBorder]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('settings.mcp_port', '端口')}
              </Text>
              <TextInput
                style={[
                  styles.portInput,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.borderSubtle,
                    backgroundColor: colors.bgSurface
                  }
                ]}
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
          </>
        ) : null}

        {applying ? <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} /> : null}
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
  portInput: {
    minWidth: 88,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    textAlign: 'right'
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
  }
})
