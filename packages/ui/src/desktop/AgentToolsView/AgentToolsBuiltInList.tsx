import React from 'react'
import { AgentToolCard } from './AgentToolCard'
import { AgentToolsCommunityTab } from './AgentToolsCommunityTab'
import type { AgentToolDef, AgentToolsConfig, ToolConfigParam, ToolManagementConfig } from './agent-tools.types'
import styles from './AgentToolsView.module.css'

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
    <div className={styles.contentArea}>
      <div className={styles.pageCard}>
        {categoryOrder.map((catKey) => {
          const list = groupedTools[catKey]
          if (!list || list.length === 0) return null
          const meta = categoryMeta[catKey]
          return (
            <div key={catKey} className={styles.categoryGroup}>
              <div className={styles.categoryHeader}>
                <span className={styles.categoryIcon}>{meta.icon}</span>
                <span className={styles.categoryLabel}>{meta.label}</span>
              </div>
              <div className={styles.categoryList}>
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
    </div>
  )
}
