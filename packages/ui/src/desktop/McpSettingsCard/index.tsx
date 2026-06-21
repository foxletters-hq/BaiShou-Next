import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdOutlineHub, MdExpandMore, MdContentCopy } from 'react-icons/md'
import '../shared/SettingsListTile.css'
import {
  isSettingsInlineHelpTarget,
  settingsInlineHelpHostProps
} from '../shared/settingsInlineHelpBlock'
import styles from './McpSettingsCard.module.css'
import { McpHelpButton } from './McpHelpButton'
import { buildMcpUrl } from './mcp-url'
import { useToast } from '../Toast/useToast'

export interface McpServerConfig {
  mcpEnabled: boolean
  mcpPort: number
  mcpAuthToken?: string
}

interface McpSettingsCardProps {
  config: McpServerConfig
  onChange: (config: McpServerConfig) => void
  /** 独立设置页：平铺展示，无折叠头 */
  standalone?: boolean
}

export { buildMcpUrl, buildMcpSseUrl } from './mcp-url'
export { McpToolsListPanel } from './McpToolsListPanel'
export type { McpToolInfo } from './McpToolsListPanel'

export const McpSettingsCard: React.FC<McpSettingsCardProps> = ({
  config,
  onChange,
  standalone = false
}) => {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = React.useState(true)
  const toast = useToast()

  const mcpUrl = buildMcpUrl(config.mcpPort)

  const handleCopyEndpoint = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(mcpUrl)
      toast.showSuccess(t('common.copied', '已复制到剪贴板'))
    } catch {
      toast.showError(t('common.copy_failed', '复制失败'))
    }
  }

  const enableRow = (
    <div
      className={`settings-list-tile settings-list-tile-noclick ${standalone ? '' : styles.indentedTile}`}
    >
      <div className="settings-list-tile-content">
        <span className={`settings-list-tile-title ${styles.titleRow}`}>
          {t('settings.mcp_enable', '启用 MCP 服务')}
          <span {...settingsInlineHelpHostProps}>
            <McpHelpButton size={16} mcpPort={config.mcpPort} mcpAuthToken={config.mcpAuthToken} />
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
      <label className="settings-switch-label" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={config.mcpEnabled}
          onChange={(e) => onChange({ ...config, mcpEnabled: e.target.checked })}
        />
        <span className="settings-switch-slider" />
      </label>
    </div>
  )

  const handleCopyToken = async () => {
    if (!config.mcpAuthToken) return
    try {
      await navigator.clipboard.writeText(config.mcpAuthToken)
      toast.showSuccess(t('common.copied', '已复制到剪贴板'))
    } catch {
      toast.showError(t('common.copy_failed', '复制失败'))
    }
  }

  const connectionContent = (
    <div className={standalone ? styles.standaloneConnectionSection : styles.connectionSection}>
      <div className={styles.portRow}>
        <span className={styles.portLabel}>{t('settings.mcp_port', '端口')}</span>
        <input
          type="number"
          className="settings-number-input"
          value={config.mcpPort}
          min={1000}
          max={65535}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10)
            if (!isNaN(val)) onChange({ ...config, mcpPort: val })
          }}
        />
      </div>
      <div className={styles.endpointRow}>
        <span className={styles.endpointLabel}>{t('settings.mcp_url_label', '连接地址')}</span>
        <span className={styles.endpointUrl}>{mcpUrl}</span>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={handleCopyEndpoint}
          aria-label={t('settings.mcp_copy_url', '复制 MCP 地址')}
          title={t('common.copy', '复制')}
        >
          <MdContentCopy size={18} />
        </button>
      </div>
      {config.mcpAuthToken ? (
        <div className={styles.endpointRow}>
          <span className={styles.endpointLabel}>{t('settings.mcp_auth_token', '访问令牌')}</span>
          <span className={styles.endpointUrl}>{config.mcpAuthToken}</span>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleCopyToken}
            aria-label={t('settings.mcp_copy_token', '复制访问令牌')}
            title={t('common.copy', '复制')}
          >
            <MdContentCopy size={18} />
          </button>
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
          <MdOutlineHub size={24} />
        </div>
        <div className="settings-list-tile-content">
          <span className={`settings-list-tile-title ${styles.titleRow}`}>
            {t('settings.mcp_title', 'MCP Server')}
            <span {...settingsInlineHelpHostProps}>
              <McpHelpButton
                size={16}
                mcpPort={config.mcpPort}
                mcpAuthToken={config.mcpAuthToken}
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
        <MdExpandMore
          size={24}
          style={{
            color: 'var(--color-on-surface-variant)',
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
    </div>
  )
}
