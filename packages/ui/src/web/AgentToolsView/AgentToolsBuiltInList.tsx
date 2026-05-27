import React from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeCheck, Store } from 'lucide-react'
import { AgentToolCard } from './AgentToolCard'
import { AgentToolsCommunityTab } from './AgentToolsCommunityTab'
import type { AgentToolDef, ToolConfigParam, ToolManagementConfig } from './agent-tools.types'
import styles from './AgentToolsView.module.css'

interface AgentToolsBuiltInListProps {
  config: ToolManagementConfig
  allTools: AgentToolDef[]
  categoryMeta: Record<string, { label: string; icon: React.ReactNode }>
  groupedTools: Record<string, AgentToolDef[]>
  showCommunity: boolean
  onShowCommunityChange: (show: boolean) => void
  onToggleTool: (toolId: string) => void
  getToolParam: (toolId: string, param: ToolConfigParam) => unknown
  setToolParam: (toolId: string, key: string, value: unknown) => void
}

export const AgentToolsBuiltInList: React.FC<AgentToolsBuiltInListProps> = ({
  config,
  allTools,
  categoryMeta,
  groupedTools,
  showCommunity,
  onShowCommunityChange,
  onToggleTool,
  getToolParam,
  setToolParam
}) => {
  const { t } = useTranslation()

  return (
    <>
      <div className={styles.tabSwitcherWrapper}>
        <div className={styles.tabSwitcher}>
          <div
            className={`${styles.tabBtn} ${!showCommunity ? styles.tabActive : ''}`}
            onClick={() => onShowCommunityChange(false)}
          >
            <BadgeCheck size={16} />
            <span className={styles.tabText}>{t('agent.tools.built_in', '内置工具')}</span>
            <span className={styles.tabBadge}>{allTools.length}</span>
          </div>
          <div
            className={`${styles.tabBtn} ${showCommunity ? styles.tabActive : ''}`}
            onClick={() => onShowCommunityChange(true)}
          >
            <Store size={16} />
            <span className={styles.tabText}>{t('agent.tools.community', '社区工具')}</span>
          </div>
        </div>
      </div>

      <div className={styles.contentArea}>
        {!showCommunity ? (
          <div className={styles.list}>
            {Object.keys(categoryMeta).map((catKey) => {
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
          </div>
        ) : (
          <AgentToolsCommunityTab />
        )}
      </div>
    </>
  )
}
