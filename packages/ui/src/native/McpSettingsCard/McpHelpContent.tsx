import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import {
  buildMcpClientJsonExample,
  buildMcpMultiWorkspaceJsonExample,
  type McpWorkspaceJsonEntry
} from '../../shared/mcp-client-config.util'
import { sharedTokens } from '../../theme/tokens'
import { mcpSettingsCardStyles as styles } from './mcp-settings-card.styles'

export interface NativeMcpHelpContentProps {
  mcpEndpointUrl: string
  mcpSseEndpointUrl?: string
  authEnabled: boolean
  authToken?: string
  workspaceStreamableEntries: McpWorkspaceJsonEntry[]
  workspaceSseEntries: McpWorkspaceJsonEntry[]
}

export const McpHelpContent: React.FC<NativeMcpHelpContentProps> = ({
  mcpEndpointUrl,
  mcpSseEndpointUrl,
  authEnabled,
  authToken,
  workspaceStreamableEntries,
  workspaceSseEntries
}) => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const codeBlockBg = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'

  return (
    <View style={{ gap: sharedTokens.spacing.mdTight }}>
      <Text style={[styles.helpIntro, { color: colors.textPrimary }]}>
        {t(
          'settings.mcp_help_intro',
          '启用 MCP 后，白守会在本机启动 MCP 服务，供 Cursor 等外部 AI 客户端调用日记、记忆等工具。'
        )}
      </Text>
      <View style={{ gap: sharedTokens.spacing.xs }}>
        <Text style={[styles.helpHeading, { color: colors.textPrimary }]}>
          {t('settings.mcp_help_cursor_title', 'Cursor')}
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
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
        <Text style={[styles.helpSubTitle, { color: colors.textSecondary }]}>
          {t('settings.mcp_help_streamable_title', '推荐：Streamable HTTP（/mcp）')}
        </Text>
        <Text
          style={[styles.helpCodeBlock, { backgroundColor: codeBlockBg, color: colors.primary }]}
        >
          {workspaceStreamableEntries.length > 1
            ? buildMcpMultiWorkspaceJsonExample(
                workspaceStreamableEntries,
                mcpEndpointUrl,
                authToken,
                'streamableHttp'
              )
            : buildMcpClientJsonExample(mcpEndpointUrl, authToken, 'streamableHttp')}
        </Text>
        {mcpSseEndpointUrl ? (
          <>
            <Text style={[styles.helpSubTitle, { color: colors.textSecondary }]}>
              {t('settings.mcp_help_sse_title', '兼容：SSE（/sse）')}
            </Text>
            <Text
              style={[
                styles.helpCodeBlock,
                {
                  backgroundColor: codeBlockBg,
                  color: colors.primary,
                  marginTop: sharedTokens.spacing.xs
                }
              ]}
            >
              {workspaceSseEntries.length > 1
                ? buildMcpMultiWorkspaceJsonExample(
                    workspaceSseEntries,
                    mcpSseEndpointUrl,
                    authToken,
                    'sse'
                  )
                : buildMcpClientJsonExample(mcpSseEndpointUrl, authToken)}
            </Text>
          </>
        ) : null}
      </View>
      <Text style={[styles.helpNote, { color: colors.textTertiary }]}>
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
}

