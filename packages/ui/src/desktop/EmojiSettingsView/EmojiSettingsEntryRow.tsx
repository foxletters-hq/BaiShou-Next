import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Smile } from 'lucide-react'
import type { EmojiToolConfig } from '@baishou/shared'
import { normalizeEmojiToolConfig } from '@baishou/shared'
import styles from './AgentToolsView.module.css'

export interface EmojiSettingsEntryRowProps {
  config: EmojiToolConfig
  onPress: () => void
}

export const EmojiSettingsEntryRow: React.FC<EmojiSettingsEntryRowProps> = ({ config, onPress }) => {
  const { t } = useTranslation()
  const normalized = normalizeEmojiToolConfig(config)
  const groupCount = normalized.groups.length
  const stickerCount = normalized.groups.reduce((sum, group) => sum + (group.emojis?.length ?? 0), 0)

  return (
    <button type="button" className={styles.emojiEntryRow} onClick={onPress}>
      <span className={styles.emojiEntryIcon}>
        <Smile size={20} />
      </span>
      <span className={styles.emojiEntryInfo}>
        <span className={styles.emojiEntryTitle}>
          {t('agent.tools.emoji_settings', '表情包设置')}
        </span>
        <span className={styles.emojiEntryMeta}>
          {normalized.enabled
            ? t('agent.tools.emoji_entry_meta', '{{groups}} 组 · {{stickers}} 个表情', {
                groups: groupCount,
                stickers: stickerCount
              })
            : t('agent.tools.emoji_disabled', '已关闭')}
        </span>
      </span>
      <ChevronRight size={18} className={styles.emojiEntryChevron} />
    </button>
  )
}
