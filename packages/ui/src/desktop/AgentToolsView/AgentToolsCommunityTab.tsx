import React from 'react'
import { useTranslation } from 'react-i18next'
import { Smile } from 'lucide-react'
import { EmojiToolCard } from './EmojiToolCard'
import type { ToolManagementConfig } from './agent-tools.types'
import styles from './AgentToolsView.module.css'

interface AgentToolsCommunityTabProps {
  config: ToolManagementConfig
  onChange: (config: ToolManagementConfig) => void
}

const COMMUNITY_CATEGORIES = [
  { key: 'interaction', labelKey: 'settings.agent_tools_category_interaction', fallback: '互动工具' }
] as const

export const AgentToolsCommunityTab: React.FC<AgentToolsCommunityTabProps> = ({
  config,
  onChange
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.list}>
      {COMMUNITY_CATEGORIES.map((cat) => {
        const meta = { label: t(cat.labelKey, cat.fallback), icon: <Smile size={18} /> }
        return (
          <div key={cat.key} className={styles.categoryGroup}>
            <div className={styles.categoryHeader}>
              <span className={styles.categoryIcon}>{meta.icon}</span>
              <span className={styles.categoryLabel}>{meta.label}</span>
            </div>
            <div className={styles.categoryList}>
              <EmojiToolCard config={config} onChange={onChange} />
            </div>
          </div>
        )
      })}
    </div>
  )
}