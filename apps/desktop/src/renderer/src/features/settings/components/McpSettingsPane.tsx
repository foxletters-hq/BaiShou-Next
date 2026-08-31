import React from 'react'
import { useTranslation } from 'react-i18next'
import { McpSettingsCard, McpToolsListPanel, SegmentedControl, SettingsPageChrome } from '@baishou/ui'
import { McpClientServersPanel } from './McpClientServersPanel'
import styles from './GeneralSettingsPane.module.css'

interface McpSettingsPaneProps {
  settings: any
  /** 嵌在工作台技能页等外层已有标题的容器里时，不再套设置页顶栏 */
  embedded?: boolean
}

export const McpSettingsPane: React.FC<McpSettingsPaneProps> = ({ settings, embedded }) => {
  const { t } = useTranslation()
  const [lanHost, setLanHost] = React.useState<string | null>(null)
  const [kind, setKind] = React.useState<'outbound' | 'custom'>('outbound')

  React.useEffect(() => {
    void (window as any).api?.settings?.getMcpLanIp?.().then((ip: string | null) => {
      if (ip) setLanHost(ip)
    })
  }, [])

  const outboundBody = (
    <>
      <div className={styles.stackGroup}>
        <div className={styles.sectionLabelRow}>
          <h3 className={styles.sectionLabel}>{t('settings.mcp_server_section', '服务配置')}</h3>
        </div>
        <section className={styles.cardSection}>
          <div className={styles.cardBody}>
            <McpSettingsCard
              standalone
              lanHost={lanHost}
              config={settings.mcpServerConfig || { mcpEnabled: false, mcpPort: 31004 }}
              onChange={settings.setMcpServerConfig}
              onRefreshToken={settings.refreshMcpAuthToken}
            />
          </div>
        </section>
      </div>

      <div className={styles.stackGroup}>
        <div className={styles.sectionLabelRow}>
          <h3 className={styles.sectionLabel}>
            {t('settings.mcp_tools_provided', '目前提供的工具列表')}
          </h3>
        </div>
        <section className={styles.cardSection}>
          <McpToolsListPanel />
        </section>
      </div>
    </>
  )

  const body = (
    <div className={styles.stack}>
      <div className={styles.kindTabs}>
        <SegmentedControl
          value={kind}
          options={[
            { value: 'outbound', label: t('settings.mcp_kind_outbound', '对外') },
            { value: 'custom', label: t('settings.mcp_kind_custom', '自定义') }
          ]}
          onChange={setKind}
          aria-label={t('settings.mcp_title', 'MCP 服务')}
        />
      </div>
      {kind === 'outbound' ? outboundBody : <McpClientServersPanel />}
    </div>
  )

  if (embedded) {
    return body
  }

  return (
    <div
      className="settings-pane settings-pane-full"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <SettingsPageChrome title={t('settings.mcp_title', 'MCP 服务')}>{body}</SettingsPageChrome>
    </div>
  )
}
