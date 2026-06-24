import React from 'react'
import { useTranslation } from 'react-i18next'
import { McpSettingsCard, McpToolsListPanel } from '@baishou/ui'
import styles from './GeneralSettingsPane.module.css'

interface McpSettingsPaneProps {
  settings: any
}

export const McpSettingsPane: React.FC<McpSettingsPaneProps> = ({ settings }) => {
  const { t } = useTranslation()

  return (
    <div
      className="settings-pane settings-pane-full"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <div className={styles.container}>
        <section className={styles.cardSection}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>{t('settings.mcp_title', 'MCP 服务')}</h3>
          </div>
          <div className={styles.cardBody}>
            <McpSettingsCard
              standalone
              config={settings.mcpServerConfig || { mcpEnabled: false, mcpPort: 31004 }}
              onChange={settings.setMcpServerConfig}
              onRefreshToken={settings.refreshMcpAuthToken}
            />
          </div>
        </section>

        <section className={styles.cardSection}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              {t('settings.mcp_tools_provided', '目前提供的工具列表')}
            </h3>
          </div>
          <McpToolsListPanel />
        </section>
      </div>
    </div>
  )
}
