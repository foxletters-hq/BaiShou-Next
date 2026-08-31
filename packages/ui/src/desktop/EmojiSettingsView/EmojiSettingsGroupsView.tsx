import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import type { EmojiToolConfig } from '@baishou/shared'
import {
  createEmojiGroup,
  isEmojiGroupNameTaken,
  normalizeEmojiToolConfig,
  removeEmojiGroup,
  upsertEmojiGroup
} from '@baishou/shared'
import { Switch } from '../Switch/Switch'
import { HelpTooltip } from '../HelpTooltip'
import { useDialog } from '../Dialog'
import { toast } from '../Toast/useToast'
import styles from '../AgentToolsView/AgentToolsView.module.css'

export interface EmojiSettingsGroupsViewProps {
  config: EmojiToolConfig
  onChange: (config: EmojiToolConfig) => void
  onOpenGroup: (groupId: string) => void
}

export const EmojiSettingsGroupsView: React.FC<EmojiSettingsGroupsViewProps> = ({
  config,
  onChange,
  onOpenGroup
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const normalized = normalizeEmojiToolConfig(config)
  const isEnabled = normalized.enabled === true

  const handleToggle = () => {
    onChange({ ...normalized, enabled: !isEnabled })
  }

  const handleAddGroup = async () => {
    const defaultName = t('agent.tools.emoji_group_default_name', '新表情包组')
    const inputName = await dialog.prompt(
      t('agent.tools.emoji_group_name_prompt', '请输入表情包组名称'),
      defaultName,
      t('agent.tools.emoji_group_add', '新建组')
    )
    if (inputName == null) return
    const trimmed = inputName.trim()
    if (!trimmed) return
    if (isEmojiGroupNameTaken(normalized, trimmed)) {
      toast.showError(
        t('agent.tools.emoji_group_name_conflict', '已存在名为「{{name}}」的组', {
          name: trimmed
        })
      )
      return
    }
    onChange(upsertEmojiGroup(normalized, createEmojiGroup(trimmed)))
  }

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    const confirmed = await dialog.confirm(
      t(
        'agent.tools.emoji_group_delete_confirm',
        '确定删除表情包组「{{name}}」吗？此操作不可撤销。',
        { name: groupName }
      ),
      t('agent.tools.emoji_group_delete_title', '删除表情包组')
    )
    if (!confirmed) return
    onChange(removeEmojiGroup(normalized, groupId))
  }

  return (
    <div className={styles.emojiSettingsPage}>
      <div className={`${styles.toolCard} ${isEnabled ? styles.enabled : styles.disabled}`}>
        <div className={styles.cardMain}>
          <div className={styles.toolInfo}>
            <div className={styles.toolNameRow}>
              <span className={styles.toolName}>{t('agent.tools.emoji_send', '表情包')}</span>
              <HelpTooltip
                content={t(
                  'agent.tools.emoji_settings_help',
                  '开启后，伙伴可在对话中根据语境发送你上传的表情包。先在下方创建表情包组并上传图片，再到伙伴编辑页为每个伙伴开启并选择可用的组。'
                )}
              />
            </div>
            <span className={styles.toolMeta}>
              {t('agent.tools.emoji_groups_hint', '为不同伙伴配置独立的表情包组')}
            </span>
          </div>
          <Switch checked={isEnabled} onChange={handleToggle} />
        </div>
      </div>

      {isEnabled ? (
        <div className={styles.categoryList}>
          <button
            type="button"
            className={styles.emojiGroupAddRow}
            onClick={() => void handleAddGroup()}
          >
            <span className={styles.emojiGroupAddIcon} aria-hidden>
              <Plus size={18} strokeWidth={2} />
            </span>
            <span className={styles.toolName}>{t('agent.tools.emoji_group_add', '新建组')}</span>
          </button>

          {normalized.groups.map((group) => (
            <div key={group.id} className={`${styles.toolCard} ${styles.enabled}`}>
              <div className={styles.cardMain}>
                <div className={styles.emojiGroupTile} aria-hidden>
                  {group.name.trim().slice(0, 1) || '组'}
                </div>
                <div className={styles.toolInfo}>
                  <div className={styles.toolNameRow}>
                    <span className={styles.toolName}>{group.name}</span>
                  </div>
                  <span className={styles.toolMeta}>
                    {t('agent.tools.emoji_group_count', '{{count}} 个表情', {
                      count: group.emojis?.length ?? 0
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.emojiGroupDeleteBtn}
                  onClick={() => void handleDeleteGroup(group.id, group.name)}
                  aria-label={t('common.delete')}
                >
                  <Trash2 size={16} />
                </button>
                <button
                  type="button"
                  className={styles.emojiSettingsBtn}
                  onClick={() => onOpenGroup(group.id)}
                  title={t('agent.tools.emoji_group_detail', '表情包组')}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
