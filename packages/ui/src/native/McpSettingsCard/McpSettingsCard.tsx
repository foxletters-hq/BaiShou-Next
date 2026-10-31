import React from 'react'
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Copy, RefreshCw } from 'lucide-react-native'
import type { McpServerConfig } from '@baishou/shared'
import { appendMcpVaultQuery, isMcpAuthEnabled } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import { Pagination } from '../Pagination/Pagination'
import { Switch } from '../Switch'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { mobileTypography, sharedTokens } from '../../theme/tokens'
import { McpHelpContent } from './McpHelpContent'
import { mcpSettingsCardStyles as styles } from './mcp-settings-card.styles'

export const MCP_WORKSPACE_PAGE_SIZE = 3

export interface NativeMcpSettingsCardProps {
  config: McpServerConfig
  mcpEndpointUrl: string
  mcpSseEndpointUrl?: string
  workspaces?: Array<{ id: string; name: string }>
  applying?: boolean
  isRunning?: boolean
  activePort?: number
  onChange: (config: McpServerConfig) => void
  onCopyEndpoint: (url?: string) => void
  onCopySseEndpoint?: (url?: string) => void
  onCopyToken?: () => void
  onRefreshToken?: () => void
}

export const McpSettingsCard: React.FC<NativeMcpSettingsCardProps> = ({
  config,
  mcpEndpointUrl,
  mcpSseEndpointUrl,
  workspaces,
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
  const { colors } = useNativeTheme()

  const [localEnabled, setLocalEnabled] = React.useState(config.mcpEnabled)
  const [localApplying, setLocalApplying] = React.useState(applying)
  const [workspacePage, setWorkspacePage] = React.useState(1)
  const authEnabled = isMcpAuthEnabled(config)
  const authTokenForUi = authEnabled ? config.mcpAuthToken : undefined

  const totalWorkspacePages = Math.max(
    1,
    Math.ceil((workspaces?.length ?? 0) / MCP_WORKSPACE_PAGE_SIZE)
  )
  const safeWorkspacePage = Math.min(workspacePage, totalWorkspacePages)

  React.useEffect(() => {
    if (workspacePage > totalWorkspacePages) {
      setWorkspacePage(totalWorkspacePages)
    }
  }, [workspacePage, totalWorkspacePages])

  const pagedWorkspaces = React.useMemo(() => {
    if (!workspaces) return []
    const start = (safeWorkspacePage - 1) * MCP_WORKSPACE_PAGE_SIZE
    return workspaces.slice(start, start + MCP_WORKSPACE_PAGE_SIZE)
  }, [workspaces, safeWorkspacePage])

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
  const baseMcpUrl = mcpEndpointUrl.split('?')[0] || `http://127.0.0.1:${displayPort}/mcp`
  const baseSseUrl = mcpSseEndpointUrl ? mcpSseEndpointUrl.split('?')[0] : undefined
  const localUrl = `http://127.0.0.1:${displayPort}/mcp`
  const subtitle = localEnabled
    ? localApplying
      ? t('settings.mcp_starting', '正在启停服务...')
      : isRunning
        ? t('settings.mcp_running', '运行中 · 端口 $port').replace('$port', String(displayPort))
        : t('settings.mcp_stopped', '已停止')
    : t('settings.mcp_desc', '允许外部 AI 通过 MCP 协议调用白守工具')

  const workspaceStreamableEntries =
    workspaces?.map((w) => ({
      name: w.name,
      url: appendMcpVaultQuery(baseMcpUrl, w.id)
    })) ?? []
  const workspaceSseEntries =
    baseSseUrl && workspaces
      ? workspaces.map((w) => ({
          name: w.name,
          url: appendMcpVaultQuery(baseSseUrl, w.id)
        }))
      : []

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
          {workspaces && workspaces.length > 0 ? (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('settings.mcp_workspaces_title', '目标小窝连接地址')}
              </Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>
                {t(
                  'settings.mcp_workspace_suffix_hint',
                  '所有小窝已同时暴露，每个小窝拥有独立的 ?vault=<小窝ID> 连接地址，支持在外部客户端中同时配置多个小窝，无需切换。'
                )}
              </Text>
              <View style={styles.workspaceList}>
                {pagedWorkspaces.map((w) => {
                  const itemMcpUrl = appendMcpVaultQuery(baseMcpUrl, w.id)
                  const itemSseUrl = baseSseUrl ? appendMcpVaultQuery(baseSseUrl, w.id) : undefined
                  return (
                    <View
                      key={w.id}
                      style={[styles.workspaceItem, { backgroundColor: colors.bgApp }]}
                    >
                      <View style={styles.workspaceItemHeader}>
                        <View style={styles.workspaceTitleGroup}>
                          <Text
                            style={[styles.workspaceName, { color: colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {w.name}
                          </Text>
                        </View>
                        <View style={styles.workspaceActions}>
                          <Pressable
                            onPress={() => onCopyEndpoint(itemMcpUrl)}
                            accessibilityLabel={t(
                              'settings.mcp_copy_workspace_url',
                              '复制 {{name}} 的 MCP 地址',
                              { name: w.name }
                            )}
                            style={({ pressed }) => [
                              styles.workspaceActionBtn,
                              {
                                backgroundColor: colors.primary,
                                borderColor: colors.primary,
                                opacity: pressed ? 0.8 : 1
                              }
                            ]}
                          >
                            <Copy
                              size={14}
                              color={colors.textOnPrimary}
                              strokeWidth={DEFAULT_STROKE_WIDTH}
                            />
                            <Text
                              style={[
                                styles.workspaceActionBtnText,
                                { color: colors.textOnPrimary }
                              ]}
                            >
                              MCP
                            </Text>
                          </Pressable>
                          {itemSseUrl && onCopySseEndpoint ? (
                            <Pressable
                              onPress={() => onCopySseEndpoint(itemSseUrl)}
                              accessibilityLabel={t(
                                'settings.mcp_copy_workspace_sse_url',
                                '复制 {{name}} 的 SSE 地址',
                                { name: w.name }
                              )}
                              style={({ pressed }) => [
                                styles.workspaceActionBtn,
                                {
                                  backgroundColor: colors.bgSurface,
                                  borderColor: colors.borderMuted,
                                  opacity: pressed ? 0.8 : 1
                                }
                              ]}
                            >
                              <Copy
                                size={14}
                                color={colors.textSecondary}
                                strokeWidth={DEFAULT_STROKE_WIDTH}
                              />
                              <Text
                                style={[
                                  styles.workspaceActionBtnText,
                                  { color: colors.textSecondary }
                                ]}
                              >
                                SSE
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                      <Text
                        style={[styles.mono, { color: colors.primary, marginTop: 0 }]}
                        selectable
                      >
                        {itemMcpUrl}
                      </Text>
                    </View>
                  )
                })}
              </View>
              {totalWorkspacePages > 1 ? (
                <View style={styles.workspacePaginationRow}>
                  <Text style={[styles.workspacePageInfo, { color: colors.textSecondary }]}>
                    {t('workspace.page_info', '共 {{total}} 个 · 第 {{page}} / {{pages}} 页', {
                      total: workspaces.length,
                      page: safeWorkspacePage,
                      pages: totalWorkspacePages
                    })}
                  </Text>
                  <Pagination
                    current={safeWorkspacePage}
                    total={totalWorkspacePages}
                    onChange={setWorkspacePage}
                  />
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('settings.mcp_url_label', '连接地址（推荐）')}
              </Text>
              <Text style={[styles.mono, { color: colors.primary }]} selectable>
                {mcpEndpointUrl}
              </Text>
              <Pressable
                onPress={() => onCopyEndpoint(mcpEndpointUrl)}
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
                      onPress={() => onCopySseEndpoint(mcpSseEndpointUrl)}
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
            </>
          )}
          {baseMcpUrl !== localUrl ? (
            <>
              <Text
                style={[
                  styles.label,
                  { color: colors.textSecondary, marginTop: sharedTokens.spacing.smPlus }
                ]}
              >
                {t('settings.mcp_url_local', '本机访问')}
              </Text>
              <Text style={[styles.mono, { color: colors.primary }]} selectable>
                {localUrl}
              </Text>
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
    <McpHelpContent
      mcpEndpointUrl={mcpEndpointUrl}
      mcpSseEndpointUrl={mcpSseEndpointUrl}
      authEnabled={authEnabled}
      authToken={authTokenForUi}
      workspaceStreamableEntries={workspaceStreamableEntries}
      workspaceSseEntries={workspaceSseEntries}
    />
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
