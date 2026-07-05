import React from 'react'
import { useTranslation } from 'react-i18next'
import { Settings, Smile } from 'lucide-react'
import type { EmojiToolConfig } from '@baishou/shared'
import { normalizeEmojiToolConfig } from '@baishou/shared'
import { Switch } from '../Switch/Switch'
import { HelpTooltip } from '../HelpTooltip'
import styles from '../AgentToolsView/AgentToolsView.module.css'

export interface EmojiSettingsEntryRowProps {
  config: EmojiToolConfig
  onChange: (config: EmojiToolConfig) => void
  onPress: () => void
}

export const EmojiSettingsEntryRow: React.FC<EmojiSettingsEntryRowProps> = ({
  config,
  onChange,
  onPress
}) => {
  const { t } = useTranslation()
  const normalized = normalizeEmojiToolConfig(config)
  const isEnabled = normalized.enabled === true
  const groupCount = normalized.groups.length
  const stickerCount = normalized.groups.reduce(
    (sum, group) => sum + (group.emojis?.length ?? 0),
    0
  )

  const handleToggle = () => {
    onChange({ ...normalized, enabled: !isEnabled })
  }

  return (
    <div className={`${styles.toolCard} ${isEnabled ? styles.enabled : styles.disabled}`}>
      <div className={styles.cardMain}>
        <div className={styles.toolIconWrapper}>
          <Smile size={20} />
        </div>
        <div className={styles.toolInfo}>
          <div className={styles.toolNameRow}>
            <span className={styles.toolName}>{t('agent.tools.emoji_send', '表情包')}</span>
            <HelpTooltip
              content={t(
                'agent.tools.emoji_settings_help',
                '开启后，伙伴可在对话中根据语境发送你上传的表情包。先在下方创建表情包组并上传图片，再到伙伴编辑页为每个伙伴开启并选择可用的组。'
              )}
            />
            <span className={styles.toolIdTag}>emoji_send</span>
          </div>
        </div>
        <button
          type="button"
          className={styles.emojiSettingsBtn}
          onClick={onPress}
          title={t('agent.tools.emoji_settings', '表情包设置')}
        >
          <Settings size={12} />
        </button>
        <Switch checked={isEnabled} onChange={handleToggle} />
      </div>

      {isEnabled ? (
        <div className={styles.paramsWrapper}>
          <div className={styles.paramsDivider} />
          <div className={styles.paramsConfigArea}>
            <span className={styles.toolMeta}>
              {t('agent.tools.emoji_entry_meta', '{{groups}} 组 · {{stickers}} 个表情', {
                groups: groupCount,
                stickers: stickerCount
              })}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
