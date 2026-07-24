import React from 'react'
import { useTranslation } from 'react-i18next'
import { McpSettingsCard, McpToolsListPanel, SettingsPageChrome } from '@baishou/ui'
import styles from './GeneralSettingsPane.module.css'

interface McpSettingsPaneProps {
  settings: any
}

export const McpSettingsPane: React.FC<McpSettingsPaneProps> = ({ settings }) => {
  const { t } = useTranslation()
  const [lanHost, setLanHost] = React.useState<string | null>(null)

  React.useEffect(() => {
    void (window as any).api?.settings?.getMcpLanIp?.().then((ip: string | null) => {
      if (ip) setLanHost(ip)
    })
  }, [])

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
      <SettingsPageChrome title={t('settings.mcp_title', 'MCP 服务')}>
        <div className={styles.container}>
          <section className={styles.pageCard}>
            <div className={styles.pageSection}>
              <div className={styles.cardBody}>
                <McpSettingsCard
                  standalone
                  lanHost={lanHost}
                  config={settings.mcpServerConfig || { mcpEnabled: false, mcpPort: 31004 }}
                  onChange={settings.setMcpServerConfig}
                  onRefreshToken={settings.refreshMcpAuthToken}
                />
              </div>
            </div>

            <div className={styles.pageSection}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  {t('settings.mcp_tools_provided', '目前提供的工具列表')}
                </h3>
              </div>
              <McpToolsListPanel />
            </div>
          </section>
        </div>
      </SettingsPageChrome>
    </div>
  )
}
