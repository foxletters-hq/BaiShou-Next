import React from 'react'
import { AgentToolCard } from './AgentToolCard'
import { AgentToolsCommunityTab } from './AgentToolsCommunityTab'
import type {
  AgentToolDef,
  AgentToolsConfig,
  ToolConfigParam,
  ToolManagementConfig
} from './agent-tools.types'
import styles from './AgentToolsView.module.css'
import stack from '../shared/SettingsStack.module.css'

interface AgentToolsBuiltInListProps {
  config: AgentToolsConfig
  categoryMeta: Record<string, { label: string; icon: React.ReactNode }>
  categoryOrder: readonly string[]
  groupedTools: Record<string, AgentToolDef[]>
  onToggleTool: (toolId: string) => void
  getToolParam: (toolId: string, param: ToolConfigParam) => unknown
  setToolParam: (toolId: string, key: string, value: unknown) => void
  onConfigChange: (config: AgentToolsConfig) => void
  onOpenEmojiSettings: () => void
  showEmojiTools?: boolean
}

export const AgentToolsBuiltInList: React.FC<AgentToolsBuiltInListProps> = ({
  config,
  categoryMeta,
  categoryOrder,
  groupedTools,
  onToggleTool,
  getToolParam,
  setToolParam,
  onConfigChange,
  onOpenEmojiSettings,
  showEmojiTools = true
}) => {
  return (
    <div className={`${styles.contentArea} ${stack.stack}`}>
      {categoryOrder.map((catKey) => {
        const list = groupedTools[catKey]
        if (!list || list.length === 0) return null
        const meta = categoryMeta[catKey]
        return (
          <div key={catKey} className={stack.stackGroup}>
            <div className={stack.sectionLabelRow}>
              <span className={styles.categoryIcon}>{meta.icon}</span>
              <h3 className={stack.sectionLabel}>{meta.label}</h3>
            </div>
            <section className={stack.cardSection}>
              <div className={styles.categoryListPadded}>
                {list.map((tool) => (
                  <AgentToolCard
                    key={tool.id}
                    tool={tool}
                    config={config}
                    onToggle={onToggleTool}
                    getToolParam={getToolParam}
                    setToolParam={setToolParam}
                  />
                ))}
              </div>
            </section>
          </div>
        )
      })}

      {showEmojiTools ? (
        <AgentToolsCommunityTab
          config={config as ToolManagementConfig}
          onConfigChange={onConfigChange as (config: ToolManagementConfig) => void}
          onOpenEmojiSettings={onOpenEmojiSettings}
        />
      ) : null}
    </div>
  )
}
