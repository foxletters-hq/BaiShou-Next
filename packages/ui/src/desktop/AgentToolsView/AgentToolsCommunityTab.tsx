import React from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeEmojiToolConfig, publishPlayfulProcessStatus } from '@baishou/shared'
import { EmojiSettingsInlinePanel } from '../EmojiSettingsView'
import { HelpTooltip } from '../HelpTooltip'
import { Switch } from '../Switch/Switch'
import type { ToolManagementConfig } from './agent-tools.types'
import styles from './AgentToolsView.module.css'
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
  const playfulEnabled = config.playfulProcessStatus !== false

  const handleTogglePlayful = () => {
    const next = !playfulEnabled
    publishPlayfulProcessStatus(next)
    onConfigChange({ ...config, playfulProcessStatus: next })
  }

  return (
    <div className={stack.stackGroup}>
      <div className={stack.sectionLabelRow}>
        <h3 className={stack.sectionLabel}>
          {t('settings.agent_tools_category_interaction', '互动工具')}
        </h3>
      </div>
      <section className={stack.cardSection}>
        <div className={stack.cardBodyPadded}>
          <div
            className={`${styles.toolCard} ${playfulEnabled ? styles.enabled : styles.disabled}`}
          >
            <div className={styles.cardMain}>
              <div className={styles.toolInfo}>
                <div className={styles.toolNameRow}>
                  <span className={styles.toolName}>
                    {t('agent.tools.playful_process_status', '趣味思考状态')}
                  </span>
                  <HelpTooltip
                    content={t(
                      'agent.tools.playful_process_status_help',
                      '开启后，伙伴在思考与调用工具时，工作过程顶部将轮播「伙伴正在喝茶…」等趣味日常状态；关闭后恢复「深度思考中…」等经典提示。'
                    )}
                  />
                </div>
                <span className={styles.toolMeta}>
                  {t(
                    'agent.tools.playful_process_status_desc',
                    '在工作过程顶部展示伙伴的趣味日常动态'
                  )}
                </span>
              </div>
              <Switch
                checked={playfulEnabled}
                aria-label={t('agent.tools.playful_process_status', '趣味思考状态')}
                onChange={handleTogglePlayful}
              />
            </div>
          </div>
          <div className={stack.divider} style={{ margin: 'var(--spacing-xs) 0' }} />
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
