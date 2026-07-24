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

export const AgentToolsCommunityTab: React.FC<AgentToolsCommunityTabProps> = ({
  config,
  onConfigChange,
  onOpenEmojiSettings
}) => {
  const { t } = useTranslation()
  const emojiConfig = normalizeEmojiToolConfig(config.emojiConfig)

  return (
    <div className={styles.categoryGroup}>
      <div className={styles.categoryHeader}>
        <span className={styles.categoryIcon}>
          <Smile size={18} />
        </span>
        <span className={styles.categoryLabel}>
          {t('settings.agent_tools_category_interaction', '互动工具')}
        </span>
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
}
