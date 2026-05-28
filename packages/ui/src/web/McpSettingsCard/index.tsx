import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdOutlineHub, MdExpandMore, MdChevronRight, MdContentCopy } from 'react-icons/md'
import '../shared/SettingsListTile.css'
import {
  isSettingsInlineHelpTarget,
  settingsInlineHelpHostProps
} from '../shared/settingsInlineHelpBlock'
import styles from './McpSettingsCard.module.css'
import { McpHelpButton } from './McpHelpButton'
import { buildMcpUrl } from './mcp-url'
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

export { buildMcpUrl, buildMcpSseUrl } from './mcp-url'

export const McpSettingsCard: React.FC<McpSettingsCardProps> = ({ config, onChange }) => {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = React.useState(true)
  const dialog = useDialog()
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
              <McpHelpButton size={16} mcpPort={config.mcpPort} />
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
          <div className={`settings-list-tile settings-list-tile-noclick ${styles.indentedTile}`}>
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('settings.mcp_enable', '启用 MCP 服务')}
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
          <div
            className={`settings-list-tile ${styles.indentedTile} ${styles.indentedTileTall}`}
            onClick={showToolsDialog}
            style={{ cursor: 'pointer' }}
          >
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('settings.mcp_view_tools', '查看已暴露的工具列表')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t(
                  'settings.mcp_view_tools_desc',
                  '查看当前 MCP 服务对外提供的日记与记忆管理等内置工具清单'
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
                  <span className={styles.endpointLabel}>
                    {t('settings.mcp_url_label', '连接地址')}
                  </span>
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
