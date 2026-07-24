import React from 'react'
import { useTranslation } from 'react-i18next'
import { Smile } from 'lucide-react'
import { normalizeEmojiToolConfig } from '@baishou/shared'
import { EmojiSettingsEntryRow } from '../EmojiSettingsView'
import type { ToolManagementConfig } from './agent-tools.types'
import styles from './AgentToolsView.module.css'
import stack from '../shared/SettingsStack.module.css'

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
    <div className={stack.stackGroup}>
      <div className={stack.sectionLabelRow}>
        <span className={styles.categoryIcon}>
          <Smile size={18} />
        </span>
        <h3 className={stack.sectionLabel}>
          {t('settings.agent_tools_category_interaction', '互动工具')}
        </h3>
      </div>
      <section className={stack.cardSection}>
        <div className={styles.categoryListPadded}>
          <EmojiSettingsEntryRow
            config={emojiConfig}
            onChange={(nextEmojiConfig) =>
              onConfigChange({ ...config, emojiConfig: nextEmojiConfig })
            }
            onPress={onOpenEmojiSettings}
          />
        </div>
      </section>
    </div>
  )
}
