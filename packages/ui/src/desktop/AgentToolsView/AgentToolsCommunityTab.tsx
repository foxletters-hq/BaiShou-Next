import React from 'react'
import { useTranslation } from 'react-i18next'
import { Smile } from 'lucide-react'
import { normalizeEmojiToolConfig } from '@baishou/shared'
import { EmojiSettingsEntryRow } from '../EmojiSettingsView'
import type { ToolManagementConfig } from './agent-tools.types'
import styles from './AgentToolsView.module.css'

interface AgentToolsCommunityTabProps {
  config: ToolManagementConfig
  onConfigChange: (config: ToolManagementConfig) => void
  onOpenEmojiSettings: () => void
}

const COMMUNITY_CATEGORIES = [
  { key: 'interaction', labelKey: 'settings.agent_tools_category_interaction', fallback: '互动工具' }
] as const

export const AgentToolsCommunityTab: React.FC<AgentToolsCommunityTabProps> = ({
  config,
  onConfigChange,
  onOpenEmojiSettings
}) => {
  const { t } = useTranslation()
  const emojiConfig = normalizeEmojiToolConfig(config.emojiConfig)

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
              <EmojiSettingsEntryRow
                config={emojiConfig}
                onChange={(nextEmojiConfig) =>
                  onConfigChange({ ...config, emojiConfig: nextEmojiConfig })
                }
                onPress={onOpenEmojiSettings}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
