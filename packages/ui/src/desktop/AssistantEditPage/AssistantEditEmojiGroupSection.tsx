import React from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import type { EmojiGroup } from '@baishou/shared'
import { Switch } from '../Switch/Switch'
import styles from './AssistantEditPage.module.css'

export interface AssistantEditEmojiGroupSectionProps {
  emojiGroups: EmojiGroup[]
  emojiEnabled: boolean
  selectedGroupIds: string[]
  onEmojiEnabledChange: (enabled: boolean) => void
  onToggleGroup: (groupId: string) => void
}

export const AssistantEditEmojiGroupSection: React.FC<AssistantEditEmojiGroupSectionProps> = ({
  emojiGroups,
  emojiEnabled,
  selectedGroupIds,
  onEmojiEnabledChange,
  onToggleGroup
}) => {
  const { t } = useTranslation()

  return (
    <>
      <div className={styles.row}>
        <div style={{ flex: 1 }}>
          <label className={styles.fieldLabel} style={{ marginBottom: 4 }}>
            {t('agent.assistant.emoji_enabled_label', '表情组')}
          </label>
          <p className={styles.descText} style={{ margin: 0 }}>
            {t(
              'agent.assistant.emoji_enabled_desc',
              '开启后，该伙伴可在对话中使用你为其选择的表情包组'
            )}
          </p>
        </div>
        <Switch checked={emojiEnabled} onChange={(e) => onEmojiEnabledChange(e.target.checked)} />
      </div>

      {emojiEnabled ? (
        <>
          <div className={styles.spacer16} />
          <label className={styles.fieldLabel}>
            {t('agent.assistant.emoji_groups_pick_label', '可用的表情包组')}
          </label>
          <div className={styles.spacer8} />
          {emojiGroups.length === 0 ? (
            <p className={styles.descText}>
              {t('agent.tools.emoji_no_groups', '请先在表情包设置中创建表情包组')}
            </p>
          ) : (
            <div className={styles.emojiGroupPickList}>
              {emojiGroups.map((group) => {
                const selected = selectedGroupIds.includes(group.id)
                return (
                  <button
                    key={group.id}
                    type="button"
                    className={`${styles.emojiGroupPickItem} ${selected ? styles.emojiGroupPickItemActive : ''}`}
                    onClick={() => onToggleGroup(group.id)}
                  >
                    <span className={styles.emojiGroupPickText}>
                      <span className={styles.emojiGroupPickName}>{group.name}</span>
                      <span className={styles.emojiGroupPickMeta}>
                        {t('agent.tools.emoji_group_count', '{{count}} 个表情', {
                          count: group.emojis?.length ?? 0
                        })}
                      </span>
                    </span>
                    {selected ? <Check size={18} /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </>
      ) : null}
    </>
  )
}
