import React from 'react'
import { useTranslation } from 'react-i18next'
import '../shared/SettingsListTile.css'
import {
  isSettingsInlineHelpTarget,
  settingsInlineHelpHostProps
} from '../shared/settingsInlineHelpBlock'
import { Switch } from '../Switch/Switch'
import { Input } from '../Input/Input'
import { Button } from '../Button/Button'
import { Pagination } from '../Pagination'
import { withAppContentOverlay } from '../overlay'
import styles from './McpSettingsCard.module.css'
import { McpHelpButton } from './McpHelpButton'
import { buildMcpSseUrl, buildMcpUrl } from './mcp-url'
import { useToast } from '../Toast/useToast'
import { Cable, ChevronDown, Copy, RefreshCw } from 'lucide-react'
import { isMcpAuthEnabled } from '@baishou/shared'

export interface McpServerConfig {
  mcpEnabled: boolean
  mcpPort: number
  mcpAuthEnabled?: boolean
  mcpAuthToken?: string
  mcpAutoApproveTools?: boolean
}

export interface McpWorkspaceOption {
  id: string
  name: string
}

interface McpSettingsCardProps {
  config: McpServerConfig
  onChange: (config: McpServerConfig) => void
  onRefreshToken?: () => void | Promise<void>
  /** 独立设置页：平铺展示，无折叠头 */
  standalone?: boolean
  /** 本机局域网 IPv4，用于展示对外连接地址 */
  lanHost?: string | null
  /** 可选工作空间列表，用于在连接地址中拼接 ?vault=<vaultId> 映射 */
  workspaces?: McpWorkspaceOption[]
  /** 当前活跃工作空间 ID，作为默认选中项 */
  activeWorkspaceId?: string
}

export { buildMcpUrl, buildMcpSseUrl } from './mcp-url'
export { McpToolsListPanel } from './McpToolsListPanel'
export type { McpToolInfo } from './McpToolsListPanel'

export const MCP_WORKSPACE_PAGE_SIZE = 3

export const McpSettingsCard: React.FC<McpSettingsCardProps> = ({
  config,
  onChange,
  onRefreshToken,
  standalone = false,
  lanHost = null,
  workspaces
}) => {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = React.useState(true)
  const [showRefreshConfirm, setShowRefreshConfirm] = React.useState(false)
  const [workspacePage, setWorkspacePage] = React.useState(1)
  const toast = useToast()

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

  const endpointHost = lanHost?.trim() || '127.0.0.1'
  const mcpUrl = buildMcpUrl(config.mcpPort, endpointHost)
  const mcpSseUrl = buildMcpSseUrl(config.mcpPort, endpointHost)
  const localhostUrl = lanHost ? buildMcpUrl(config.mcpPort, '127.0.0.1') : null
  const localhostSseUrl = lanHost ? buildMcpSseUrl(config.mcpPort, '127.0.0.1') : null
  const authEnabled = isMcpAuthEnabled(config)
  const authTokenForUi = authEnabled ? config.mcpAuthToken : undefined

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.showSuccess(t('common.copied', '已复制到剪贴板'))
    } catch {
      toast.showError(t('common.copy_failed', '复制失败'))
    }
  }

  const handleToggleAuth = (checked: boolean) => {
    onChange({ ...config, mcpAuthEnabled: checked })
  }

  const enableRow = (
    <div
      className={`settings-list-tile settings-list-tile-noclick ${standalone ? '' : styles.indentedTile}`}
    >
      <div className="settings-list-tile-content">
        <span className={`settings-list-tile-title ${styles.titleRow}`}>
          {t('settings.mcp_enable', '启用 MCP 服务')}
          <span {...settingsInlineHelpHostProps}>
            <McpHelpButton
              size={16}
              mcpPort={config.mcpPort}
              mcpAuthEnabled={authEnabled}
              mcpAuthToken={authTokenForUi}
              lanHost={lanHost}
              workspaces={workspaces}
            />
          </span>
          {config.mcpEnabled ? <span className={styles.statusIndicator} aria-hidden /> : null}
        </span>
        <span className="settings-list-tile-subtitle">
          {config.mcpEnabled
            ? t('settings.mcp_running', '运行中 · 端口 $port').replace(
                '$port',
                config.mcpPort.toString()
              )
            : t('settings.mcp_desc', '允许外部 AI 通过 MCP 协议调用白守工具')}
        </span>
      </div>
      <Switch
        checked={config.mcpEnabled}
        aria-label={t('settings.mcp_enable', '启用 MCP 服务')}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange({ ...config, mcpEnabled: e.target.checked })}
      />
    </div>
  )

  const handleConfirmRefreshToken = async () => {
    setShowRefreshConfirm(false)
    try {
      await onRefreshToken?.()
      toast.showSuccess(t('settings.mcp_token_refreshed', '访问令牌已刷新'))
    } catch {
      toast.showError(t('common.errors.save_failed', '保存失败'))
    }
  }

  const refreshConfirmDialog = showRefreshConfirm ? (
    <div
      className={withAppContentOverlay(styles.confirmOverlay)}
      onClick={() => setShowRefreshConfirm(false)}
    >
      <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.confirmTitle}>
          {t('settings.mcp_refresh_token_title', '刷新访问令牌')}
        </div>
        <div className={styles.confirmMessage}>
          {t(
            'settings.mcp_refresh_token_message',
            '刷新后旧令牌将立即失效，已配置的外部客户端需要更新 Authorization 头。确定要继续吗？'
          )}
        </div>
        <div className={styles.confirmActions}>
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={() => setShowRefreshConfirm(false)}
          >
            {t('common.cancel', '取消')}
          </Button>
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={() => void handleConfirmRefreshToken()}
          >
            {t('settings.mcp_refresh_token_confirm', '刷新令牌')}
          </Button>
        </div>
      </div>
    </div>
  ) : null

  const connectionContent = (
    <div className={standalone ? styles.standaloneConnectionSection : styles.connectionSection}>
      <div className={styles.portRow}>
        <span className={styles.portLabel}>{t('settings.mcp_port', '端口')}</span>
        <Input
          type="number"
          fieldSize="small"
          className={styles.portInputHost}
          value={config.mcpPort}
          min={1000}
          max={65535}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10)
            if (!isNaN(val)) onChange({ ...config, mcpPort: val })
          }}
        />
      </div>
      {workspaces && workspaces.length > 0 ? (
        <div className={styles.workspaceListSection}>
          <div className={styles.workspaceSectionHeader}>
            <span className={styles.portLabel}>
              {t('settings.mcp_workspaces_title', '目标小窝连接地址')}
            </span>
            <span className={styles.workspaceHint}>
              {t(
                'settings.mcp_workspace_suffix_hint',
                '所有小窝已同时暴露，每个小窝拥有独立的 ?vault=<小窝ID> 连接地址，支持在外部客户端中同时配置多个小窝，无需切换。'
              )}
            </span>
          </div>
          <div className={styles.workspaceList}>
            {pagedWorkspaces.map((w) => {
              const itemMcpUrl = buildMcpUrl(config.mcpPort, endpointHost, w.id)
              const itemSseUrl = buildMcpSseUrl(config.mcpPort, endpointHost, w.id)
              return (
                <div key={w.id} className={styles.workspaceItemRow}>
                  <div className={styles.workspaceItemMeta}>
                    <div className={styles.workspaceItemTitleRow}>
                      <span className={styles.workspaceItemName}>{w.name}</span>
                    </div>
                    <span className={styles.endpointUrl} title={itemMcpUrl}>
                      {itemMcpUrl}
                    </span>
                  </div>
                  <div className={styles.workspaceItemActions}>
                    <button
                      type="button"
                      className={styles.copyBtn}
                      onClick={(e) => {
                        e.stopPropagation()
                        void copyText(itemMcpUrl)
                      }}
                      aria-label={t(
                        'settings.mcp_copy_workspace_url',
                        '复制 {{name}} 的 MCP 地址',
                        {
                          name: w.name
                        }
                      )}
                      title={t('settings.mcp_copy_url', '复制 MCP 地址')}
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      type="button"
                      className={styles.copySseTagBtn}
                      onClick={(e) => {
                        e.stopPropagation()
                        void copyText(itemSseUrl)
                      }}
                      aria-label={t(
                        'settings.mcp_copy_workspace_sse_url',
                        '复制 {{name}} 的 SSE 地址',
                        { name: w.name }
                      )}
                      title={itemSseUrl}
                    >
                      <span>SSE</span>
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          {totalWorkspacePages > 1 ? (
            <div className={styles.workspacePaginationRow}>
              <span className={styles.workspacePageInfo}>
                {t('workspace.page_info', '共 {{total}} 个 · 第 {{page}} / {{pages}} 页', {
                  total: workspaces.length,
                  page: safeWorkspacePage,
                  pages: totalWorkspacePages
                })}
              </span>
              <Pagination
                current={safeWorkspacePage}
                total={totalWorkspacePages}
                onChange={setWorkspacePage}
                siblingCount={1}
                showJumper={false}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className={styles.endpointRow}>
            <span className={styles.endpointLabel}>
              {t('settings.mcp_url_label', '连接地址（推荐）')}
            </span>
            <span className={styles.endpointUrl}>{mcpUrl}</span>
            <button
              type="button"
              className={styles.copyBtn}
              onClick={(e) => {
                e.stopPropagation()
                void copyText(mcpUrl)
              }}
              aria-label={t('settings.mcp_copy_url', '复制 MCP 地址')}
              title={t('common.copy', '复制')}
            >
              <Copy size={18} />
            </button>
          </div>
          <div className={styles.endpointRow}>
            <span className={styles.endpointLabel}>
              {t('settings.mcp_sse_url_label', 'SSE 地址（兼容）')}
            </span>
            <span className={styles.endpointUrl}>{mcpSseUrl}</span>
            <button
              type="button"
              className={styles.copyBtn}
              onClick={(e) => {
                e.stopPropagation()
                void copyText(mcpSseUrl)
              }}
              aria-label={t('settings.mcp_copy_sse_url', '复制 SSE 地址')}
              title={t('common.copy', '复制')}
            >
              <Copy size={18} />
            </button>
          </div>
        </>
      )}
      {localhostUrl ? (
        <div className={styles.endpointRow}>
          <span className={styles.endpointLabel}>
            {t('settings.mcp_localhost_url_label', '本机访问')}
          </span>
          <span className={`${styles.endpointUrl} ${styles.endpointUrlSecondary}`}>
            {localhostUrl}
            {localhostSseUrl ? ` · ${localhostSseUrl}` : null}
          </span>
        </div>
      ) : null}
      <div className={`settings-list-tile settings-list-tile-noclick ${styles.authToggleRow}`}>
        <div className="settings-list-tile-content">
          <span className="settings-list-tile-title">
            {t('settings.mcp_auth_enable', '启用鉴权')}
          </span>
          <span className="settings-list-tile-subtitle">
            {t('settings.mcp_auth_enable_desc', '开启后外部客户端需携带访问令牌')}
          </span>
        </div>
        <Switch
          checked={authEnabled}
          aria-label={t('settings.mcp_auth_enable', '启用鉴权')}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleToggleAuth(e.target.checked)}
        />
      </div>
      {authEnabled && authTokenForUi ? (
        <div className={styles.endpointRow}>
          <span className={styles.endpointLabel}>{t('settings.mcp_auth_token', '访问令牌')}</span>
          <span className={styles.endpointUrl}>{authTokenForUi}</span>
          <div className={styles.tokenActions}>
            {onRefreshToken ? (
              <button
                type="button"
                className={styles.copyBtn}
                onClick={() => setShowRefreshConfirm(true)}
                aria-label={t('settings.mcp_refresh_token', '刷新访问令牌')}
                title={t('settings.mcp_refresh_token', '刷新访问令牌')}
              >
                <RefreshCw size={18} />
              </button>
            ) : null}
            <button
              type="button"
              className={styles.copyBtn}
              onClick={() => void copyText(authTokenForUi)}
              aria-label={t('settings.mcp_copy_token', '复制访问令牌')}
              title={t('common.copy', '复制')}
            >
              <Copy size={18} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )

  const connectionCollapse = (
    <div
      className={`${styles.connectionCollapseWrapper} ${config.mcpEnabled ? styles.connectionCollapseOpen : ''}`}
    >
      <div className={styles.connectionCollapseInner}>
        <div className={`settings-list-divider ${standalone ? '' : 'indent'}`} />
        {connectionContent}
      </div>
    </div>
  )

  if (standalone) {
    return (
      <div className={styles.standaloneRoot}>
        {enableRow}
        {connectionCollapse}
        {refreshConfirmDialog}
      </div>
    )
  }

  return (
    <div>
      <div
        className="settings-list-tile"
        onClick={(e) => {
          if (isSettingsInlineHelpTarget(e.target)) return
          setCollapsed((v) => !v)
        }}
        style={{ cursor: 'pointer' }}
      >
        <div className="settings-list-tile-leading">
          <Cable size={24} />
        </div>
        <div className="settings-list-tile-content">
          <span className={`settings-list-tile-title ${styles.titleRow}`}>
            {t('settings.mcp_title', 'MCP Server')}
            <span {...settingsInlineHelpHostProps}>
              <McpHelpButton
                size={16}
                mcpPort={config.mcpPort}
                mcpAuthEnabled={authEnabled}
                mcpAuthToken={authTokenForUi}
                lanHost={lanHost}
                workspaces={workspaces}
              />
            </span>
            {config.mcpEnabled && <span className={styles.statusIndicator} aria-hidden />}
          </span>
          <span className="settings-list-tile-subtitle">
            {config.mcpEnabled
              ? t('settings.mcp_running', '运行中 · 端口 $port').replace(
                  '$port',
                  config.mcpPort.toString()
                )
              : t('settings.mcp_desc', '允许外部 AI 通过 MCP 协议调用白守工具')}
          </span>
        </div>
        <ChevronDown
          size={24}
          style={{
            color: 'var(--text-secondary)',
            transition: 'transform 0.25s',
            transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            flexShrink: 0
          }}
        />
      </div>

      <div className={`${styles.collapseWrapper} ${collapsed ? '' : styles.collapseOpen}`}>
        <div className={styles.collapseInner}>
          <div className="settings-list-divider indent" />
          {enableRow}
          {connectionCollapse}
        </div>
      </div>
      {refreshConfirmDialog}
    </div>
  )
}
