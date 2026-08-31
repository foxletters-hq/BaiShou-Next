import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Smile } from 'lucide-react'
import type { EmojiToolConfig } from '@baishou/shared'
import { normalizeEmojiToolConfig } from '@baishou/shared'
import { Switch } from '../Switch/Switch'
import { AssistantEmojiGroupPickerDialog } from './AssistantEmojiGroupPickerDialog'
import styles from './AssistantEditPage.module.css'

export interface AssistantEditEmojiGroupSectionProps {
  emojiConfig: EmojiToolConfig
  emojiEnabled: boolean
  selectedGroupIds: string[]
  onEmojiEnabledChange: (enabled: boolean) => void
  onToggleGroup: (groupId: string) => void
  onEmojiConfigChange: (config: EmojiToolConfig) => void
}

export const AssistantEditEmojiGroupSection: React.FC<AssistantEditEmojiGroupSectionProps> = ({
  emojiConfig,
  emojiEnabled,
  selectedGroupIds,
  onEmojiEnabledChange,
  onToggleGroup,
  onEmojiConfigChange
}) => {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const groups = useMemo(() => normalizeEmojiToolConfig(emojiConfig).groups, [emojiConfig])
  const selectedGroups = groups.filter((group) => selectedGroupIds.includes(group.id))
  const summary =
    selectedGroups.length === 0
      ? t('agent.assistant.emoji_groups_none_selected', '未选择表情包组')
      : t('agent.assistant.emoji_groups_selected_summary', '已选 {{count}} 组：{{names}}', {
          count: selectedGroups.length,
          names: selectedGroups.map((group) => group.name).join('、')
        })

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
          <button
            type="button"
            className={styles.emojiGroupPickerTrigger}
            onClick={() => setPickerOpen(true)}
          >
            <span className={styles.emojiGroupPickLeading}>
              <span className={styles.emojiGroupPickIcon} aria-hidden>
                <Smile size={18} />
              </span>
              <span className={styles.emojiGroupPickText}>
                <span className={styles.emojiGroupPickName}>
                  {t('agent.assistant.emoji_groups_pick_label', '可用的表情包组')}
                </span>
                <span className={styles.emojiGroupPickMeta}>{summary}</span>
              </span>
            </span>
            <ChevronRight size={18} aria-hidden />
          </button>
        </>
      ) : null}

      <AssistantEmojiGroupPickerDialog
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        emojiConfig={emojiConfig}
        selectedGroupIds={selectedGroupIds}
        onToggleGroup={onToggleGroup}
        onEmojiConfigChange={onEmojiConfigChange}
      />
    </>
  )
}
