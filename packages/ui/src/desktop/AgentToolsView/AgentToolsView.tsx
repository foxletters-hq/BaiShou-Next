import React from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentToolsViewProps } from './agent-tools.types'
import { useAgentToolsView } from './useAgentToolsView'
import { AgentToolsBuiltInList } from './AgentToolsBuiltInList'
import styles from './AgentToolsView.module.css'

export type { ToolManagementConfig, AgentToolsViewProps } from './agent-tools.types'

export const AgentToolsView: React.FC<AgentToolsViewProps> = ({ config, onChange }) => {
  const { t } = useTranslation()
  const view = useAgentToolsView({ config, onChange })

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t('settings.agent_tools_title', '工具管理')}</h3>
      </div>

      <div className={styles.scrollArea}>
        <p className={styles.subtitle}>
          {t('settings.agent_tools_desc', '管理伙伴可使用的工具，开关或配置工具参数')}
        </p>

        <AgentToolsBuiltInList
          config={config}
          allTools={view.allTools}
          categoryMeta={view.categoryMeta}
          groupedTools={view.groupedTools}
          showCommunity={view.showCommunity}
          onShowCommunityChange={view.setShowCommunity}
          onToggleTool={view.toggleTool}
          getToolParam={view.getToolParam}
          setToolParam={view.setToolParam}
          onConfigChange={onChange}
        />
      </div>
    </div>
  )
}
