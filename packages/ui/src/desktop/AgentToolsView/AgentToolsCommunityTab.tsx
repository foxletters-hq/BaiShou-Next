import React from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeEmojiToolConfig } from '@baishou/shared'
import { EmojiSettingsInlinePanel } from '../EmojiSettingsView'
import type { ToolManagementConfig } from './agent-tools.types'
import stack from '../shared/SettingsStack.module.css'

interface AgentToolsCommunityTabProps {
  config: ToolManagementConfig
  onConfigChange: (config: ToolManagementConfig) => void
  /** @deprecated 表情包已改为同页列表，不再打开子页 */
  onOpenEmojiSettings?: () => void
}

export const AgentToolsCommunityTab: React.FC<AgentToolsCommunityTabProps> = ({
  config,
  onConfigChange
}) => {
  const { t } = useTranslation()
  const emojiConfig = normalizeEmojiToolConfig(config.emojiConfig)

  return (
    <div className={stack.stackGroup}>
      <div className={stack.sectionLabelRow}>
        <h3 className={stack.sectionLabel}>
          {t('settings.agent_tools_category_interaction', '互动工具')}
        </h3>
      </div>
      <section className={stack.cardSection}>
        <div className={stack.cardBodyPadded}>
          <EmojiSettingsInlinePanel
            config={emojiConfig}
            onChange={(nextEmojiConfig) =>
              onConfigChange({ ...config, emojiConfig: nextEmojiConfig })
            }
          />
        </div>
      </section>
    </div>
  )
}
