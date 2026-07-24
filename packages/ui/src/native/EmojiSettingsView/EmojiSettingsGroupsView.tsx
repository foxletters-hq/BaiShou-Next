import React from 'react'
import { useTranslation } from 'react-i18next'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { ChevronRight, Plus, Smile, Trash2 } from 'lucide-react-native'
import type { EmojiToolConfig } from '@baishou/shared'
import {
  createEmojiGroup,
  isEmojiGroupNameTaken,
  normalizeEmojiToolConfig,
  removeEmojiGroup,
  upsertEmojiGroup
} from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'

export interface EmojiSettingsGroupsViewProps {
  config: EmojiToolConfig
  onChange: (config: EmojiToolConfig) => void
  onOpenGroup: (groupId: string) => void
  /** 新建组时弹出名称输入；返回 null 表示取消 */
  onPromptGroupName?: (defaultName: string) => Promise<string | null>
  /** 组名重复时提示 */
  onGroupNameConflict?: (name: string) => void
  /** 删除组前确认；返回 false 则取消 */
  onConfirmDeleteGroup?: (groupName: string) => Promise<boolean>
}

export const EmojiSettingsGroupsView: React.FC<EmojiSettingsGroupsViewProps> = ({
  config,
  onChange,
  onOpenGroup,
  onPromptGroupName,
  onGroupNameConflict,
  onConfirmDeleteGroup
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const normalized = normalizeEmojiToolConfig(config)
  const isEnabled = normalized.enabled === true

  const handleToggle = () => {
    onChange({ ...normalized, enabled: !isEnabled })
  }

  const handleAddGroup = async () => {
    const defaultName = t('agent.tools.emoji_group_default_name', '新表情包组')
    const inputName = onPromptGroupName ? await onPromptGroupName(defaultName) : defaultName
    if (inputName == null) return

    const trimmed = inputName.trim()
    if (!trimmed) return

    if (isEmojiGroupNameTaken(normalized, trimmed)) {
      onGroupNameConflict?.(trimmed)
      return
    }

    const group = createEmojiGroup(trimmed)
    onChange(upsertEmojiGroup(normalized, group))
  }

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (onConfirmDeleteGroup) {
      const confirmed = await onConfirmDeleteGroup(groupName)
      if (!confirmed) return
    }
    onChange(removeEmojiGroup(normalized, groupId))
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.enableCard,
          {
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderRadius: tokens.radius.lg
          }
        ]}
      >
        <View style={styles.enableRow}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryContainer }]}>
            <Smile size={20} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
          </View>
          <View style={styles.enableText}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('agent.tools.emoji_send', '表情包')}
              </Text>
              <HelpTooltip
                content={t(
                  'agent.tools.emoji_settings_help',
                  '开启后，伙伴可在对话中根据语境发送你上传的表情包。先在下方创建表情包组并上传图片，再到伙伴编辑页为每个伙伴开启并选择可用的组。'
                )}
                size={16}
              />
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('agent.tools.emoji_groups_hint', '为不同伙伴配置独立的表情包组')}
            </Text>
          </View>
          <Switch value={isEnabled} onValueChange={handleToggle} />
        </View>
      </View>

      {isEnabled ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {t('agent.tools.emoji_groups_title', '表情包组')}
            </Text>
            <TouchableOpacity style={styles.addGroupBtn} onPress={() => void handleAddGroup()}>
              <Plus size={16} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
              <Text style={[styles.addGroupText, { color: colors.primary }]}>
                {t('agent.tools.emoji_group_add', '新建组')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 10 }}>
            {normalized.groups.length === 0 ? (
              <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
                {t('agent.tools.emoji_groups_empty', '暂无表情包组，点击「新建组」开始添加')}
              </Text>
            ) : (
              normalized.groups.map((group) => (
                <View
                  key={group.id}
                  style={[
                    styles.groupCard,
                    {
                      backgroundColor: colors.bgSurface,
                      borderColor: colors.borderSubtle,
                      borderRadius: tokens.radius.lg
                    }
                  ]}
                >
                  <TouchableOpacity style={styles.groupMain} onPress={() => onOpenGroup(group.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.groupName, { color: colors.textPrimary }]}>
                        {group.name}
                      </Text>
                      <Text style={[styles.groupMeta, { color: colors.textTertiary }]}>
                        {t('agent.tools.emoji_group_count', '{{count}} 个表情', {
                          count: group.emojis?.length ?? 0
                        })}
                      </Text>
                    </View>
                    <ChevronRight
                      size={18}
                      color={colors.textTertiary}
                      strokeWidth={DEFAULT_STROKE_WIDTH}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteGroupBtn}
                    onPress={() => void handleDeleteGroup(group.id, group.name)}
                    accessibilityLabel={t('common.delete')}
                  >
                    <Trash2 size={16} color={colors.error} strokeWidth={DEFAULT_STROKE_WIDTH} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  enableCard: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16
  },
  enableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  enableText: { flex: 1, gap: 4 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 13, lineHeight: 18 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase'
  },
  addGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6
  },
  addGroupText: { fontSize: 14, fontWeight: '600' },
  emptyHint: { fontSize: 14, paddingHorizontal: 4, lineHeight: 20 },
  groupCard: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center'
  },
  groupMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8
  },
  groupName: { fontSize: 16, fontWeight: '600' },
  groupMeta: { fontSize: 13, marginTop: 2 },
  deleteGroupBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14
  }
})
