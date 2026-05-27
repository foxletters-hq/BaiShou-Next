import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdOutlineHub, MdExpandMore, MdChevronRight, MdContentCopy } from 'react-icons/md'
import '../shared/SettingsListTile.css'
import styles from './McpSettingsCard.module.css'
import { HelpTooltip } from '../HelpTooltip'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'

export interface McpServerConfig {
  mcpEnabled: boolean
  mcpPort: number
}

interface McpSettingsCardProps {
  config: McpServerConfig
  onChange: (config: McpServerConfig) => void
}

export const McpSettingsCard: React.FC<McpSettingsCardProps> = ({ config, onChange }) => {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = React.useState(true)
  const dialog = useDialog()
  const toast = useToast()

  const mcpEndpointUrl = `http://localhost:${config.mcpPort}/mcp`

  const handleCopyEndpoint = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(mcpEndpointUrl)
      toast.showSuccess(t('common.copied', 'Copied to clipboard'))
    } catch {
      toast.showError(t('common.copy_failed', 'Copy failed'))
    }
  }

  const showToolsDialog = async () => {
    try {
      const tools = await (window as any).api?.settings?.getMcpTools()
      if (!tools || tools.length === 0) {
        dialog.alert(
          t('settings.mcp_no_tools', '未检测到任何暴露的工具'),
          t('settings.mcp_tools_list', 'MCP 工具列表')
        )
        return
      }

      const content = (
        <div style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tools.map((tItem: any) => {
              const cleanName = tItem.displayName || tItem.name.replace(/^baishou_/, '')
              const localizedTitle = t(`agent.tools.${cleanName}`, cleanName) as string
              const localizedDesc = t(`agent.tools.${cleanName}_desc`, tItem.description) as string

              return (
                <div
                  key={tItem.name}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--color-surface-container-low, rgba(0, 0, 0, 0.02))',
                    border: '1px solid var(--color-outline-variant, rgba(0, 0, 0, 0.08))'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px'
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-primary, #5BA8F5)'
                      }}
                    >
                      {tItem.name}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'var(--color-secondary-container, rgba(0, 0, 0, 0.05))',
                        color: 'var(--color-on-secondary-container, var(--color-text-secondary))'
                      }}
                    >
                      {tItem.category || 'general'}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-on-surface-variant, var(--color-text-secondary))',
                        fontWeight: 500
                      }}
                    >
                      ({localizedTitle})
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--color-on-surface-variant, var(--color-text-secondary))',
                      lineHeight: '1.4',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {localizedDesc}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )

      dialog.alert(content, t('settings.mcp_tools_list', 'MCP 暴露工具列表'))
    } catch (e) {
      console.error(e)
      dialog.alert(t('settings.mcp_tools_fetch_failed', '获取工具列表失败'))
    }
  }

  return (
    <div>
      {/* 标题行：点击展开/收起 */}
      <div
        className="settings-list-tile"
        onClick={() => setCollapsed(!collapsed)}
        style={{ cursor: 'pointer' }}
      >
        <div className="settings-list-tile-leading">
          <MdOutlineHub size={24} />
        </div>
        <div className="settings-list-tile-content">
          <span
            className="settings-list-tile-title"
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            {t('settings.mcp_title', 'MCP Server')}
            <HelpTooltip
              content={t(
                'settings.tooltip_mcp_server',
                '允许外部 AI 客户端（如 Cursor、Windsurf、VS Code Claude Dev 插件等）通过 MCP 协议调用白守的数据与工具。'
              )}
              size={16}
              style={{ marginLeft: '4px' }}
            />
            {config.mcpEnabled && <div className={styles.statusIndicator} />}
          </span>
          <span className="settings-list-tile-subtitle">
            {config.mcpEnabled
              ? t('settings.mcp_running', 'Running · Port $port').replace(
                  '$port',
                  config.mcpPort.toString()
                )
              : t('settings.mcp_desc', 'Allow external AI to call BaiShou tools via MCP protocol')}
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

      {/* 可折叠内容区域 */}
      <div className={`${styles.collapseWrapper} ${collapsed ? '' : styles.collapseOpen}`}>
        <div className={styles.collapseInner}>
          {/* 开关行 */}
          <div className="settings-list-divider indent" />
          <div className={`settings-list-tile settings-list-tile-noclick ${styles.indentedTile}`}>
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('settings.mcp_enable', 'Enable MCP Server')}
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

          <div className="settings-list-divider indent" />
          {/* 查看暴露工具行 */}
          <div
            className={`settings-list-tile ${styles.indentedTile} ${styles.indentedTileTall}`}
            onClick={showToolsDialog}
            style={{ cursor: 'pointer' }}
          >
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('settings.mcp_view_tools', 'View Exposed Tools')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t(
                  'settings.mcp_view_tools_desc',
                  'View the list of built-in tools (such as diary and memory management) exposed by the MCP server'
                )}
              </span>
            </div>
            <MdChevronRight size={20} style={{ color: 'var(--color-on-surface-variant)' }} />
          </div>

          {config.mcpEnabled && (
            <>
              <div className="settings-list-divider indent" />
              <div className={styles.connectionSection}>
                <div className={styles.portRow}>
                  <span className={styles.portLabel}>{t('settings.mcp_port', 'Port')}</span>
                  <input
                    type="number"
                    className="settings-number-input"
                    value={config.mcpPort}
                    min={1000}
                    max={65535}
                    onChange={(e) => {
                      const val = parseInt(e.target.value)
                      if (!isNaN(val)) onChange({ ...config, mcpPort: val })
                    }}
                  />
                </div>
                <div className={styles.endpointRow}>
                  <span className={`settings-monospace ${styles.endpointUrl}`}>
                    {mcpEndpointUrl}
                  </span>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={handleCopyEndpoint}
                    aria-label={t('settings.mcp_copy_url', 'Copy MCP URL')}
                    title={t('common.copy', 'Copy')}
                  >
                    <MdContentCopy size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
