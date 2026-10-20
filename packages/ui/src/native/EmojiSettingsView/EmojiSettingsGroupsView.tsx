import React from 'react'
import { useTranslation } from 'react-i18next'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { ChevronRight, Plus, Trash2 } from 'lucide-react-native'
import type { EmojiSendFrequency, EmojiToolConfig } from '@baishou/shared'
import {
  createEmojiGroup,
  isEmojiGroupNameTaken,
  normalizeEmojiSendFrequency,
  normalizeEmojiToolConfig,
  removeEmojiGroup,
  upsertEmojiGroup
} from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { SegmentedControl } from '../SegmentedControl'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

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
  const frequency = normalizeEmojiSendFrequency(normalized.frequency)
  const frequencyOptions: Array<{ value: EmojiSendFrequency; label: string }> = [
    { value: 'low', label: t('agent.tools.emoji_frequency_low', '较少') },
    { value: 'normal', label: t('agent.tools.emoji_frequency_normal', '适中') },
    { value: 'high', label: t('agent.tools.emoji_frequency_high', '频繁') },
    { value: 'always', label: t('agent.tools.emoji_frequency_always', '每条回复') }
  ]
  const frequencyHints: Record<EmojiSendFrequency, string> = {
    low: t('agent.tools.emoji_frequency_hint_low', '仅在特别贴合语境时偶尔发送'),
    normal: t('agent.tools.emoji_frequency_hint_normal', '语境合适时发送，不会每条都带'),
    high: t('agent.tools.emoji_frequency_hint_high', '大多数回复都会配上表情包'),
    always: t('agent.tools.emoji_frequency_hint_always', '每条回复都发送一个表情包（仍最多一个）')
  }

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

        {isEnabled ? (
          <View style={[styles.frequencySection, { borderTopColor: colors.borderSubtle }]}>
            <View style={styles.frequencyHeader}>
              <Text style={[styles.frequencyLabel, { color: colors.textPrimary }]}>
                {t('agent.tools.emoji_frequency_label', '发送频率')}
              </Text>
              <Text style={[styles.frequencyHint, { color: colors.textSecondary }]}>
                {frequencyHints[frequency]}
              </Text>
            </View>
            <SegmentedControl
              size="small"
              value={frequency}
              options={frequencyOptions}
              onChange={(nextFrequency) => onChange({ ...normalized, frequency: nextFrequency })}
              accessibilityLabel={t('agent.tools.emoji_frequency_label', '发送频率')}
            />
          </View>
        ) : null}
      </View>

      {isEnabled ? (
        <>
          <View style={{ gap: sharedTokens.spacing.smPlus }}>
            <TouchableOpacity style={styles.addGroupRow} onPress={() => void handleAddGroup()}>
              <View
                style={[
                  styles.addGroupIcon,
                  { borderColor: colors.borderSubtle, backgroundColor: colors.bgSurface }
                ]}
              >
                <Plus size={18} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
              </View>
              <Text style={[styles.groupName, { color: colors.textPrimary }]}>
                {t('agent.tools.emoji_group_add', '新建组')}
              </Text>
            </TouchableOpacity>
            {normalized.groups.map((group) => (
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
                  <View style={[styles.groupTile, { backgroundColor: colors.primaryContainer }]}>
                    <Text style={[styles.groupTileText, { color: colors.primary }]}>
                      {group.name.trim().slice(0, 1) ||
                        t(
                          'auto.packages.ui.src.native.EmojiSettingsView.EmojiSettingsGroupsView.L137',
                          '组'
                        )}
                    </Text>
                  </View>
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
            ))}
          </View>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: sharedTokens.spacing.md },
  enableCard: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: sharedTokens.spacing.md
  },
  enableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight
  },
  enableText: { flex: 1, gap: sharedTokens.spacing.xs },
  frequencySection: {
    marginTop: sharedTokens.spacing.mdTight,
    paddingTop: sharedTokens.spacing.mdTight,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: sharedTokens.spacing.sm
  },
  frequencyHeader: { gap: sharedTokens.spacing.xxs },
  frequencyLabel: { fontSize: mobileTypography.secondary.fontSize, fontWeight: '600' },
  frequencyHint: { fontSize: mobileTypography.secondary.fontSize, lineHeight: 18 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  title: { fontSize: mobileTypography.primary.fontSize, fontWeight: '600' },
  subtitle: { fontSize: mobileTypography.secondary.fontSize, lineHeight: 18 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sharedTokens.spacing.xs
  },
  sectionTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase'
  },
  addGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    paddingVertical: sharedTokens.spacing.xs,
    paddingHorizontal: sharedTokens.spacing.xsPlus
  },
  addGroupText: { fontSize: mobileTypography.secondary.fontSize, fontWeight: '600' },
  addGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdTight
  },
  addGroupIcon: {
    width: 32,
    height: 32,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  groupTile: {
    width: 32,
    height: 32,
    borderRadius: sharedTokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  groupTileText: { fontSize: mobileTypography.secondary.fontSize, fontWeight: '600' },
  groupCard: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center'
  },
  groupMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdSnug,
    gap: sharedTokens.spacing.sm
  },
  groupName: { fontSize: mobileTypography.primary.fontSize, fontWeight: '600' },
  groupMeta: { fontSize: mobileTypography.secondary.fontSize, marginTop: sharedTokens.spacing.xxs },
  deleteGroupBtn: {
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.mdSnug
  }
})
