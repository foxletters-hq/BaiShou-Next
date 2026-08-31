import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { ChevronRight, Smile } from 'lucide-react-native'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { useTranslation } from 'react-i18next'
import type { EmojiToolConfig } from '@baishou/shared'
import { normalizeEmojiToolConfig } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { SettingsGroupCard } from '../settings/SettingsGroupCard'
import { settingsCardStyles } from '../settings/settings-card.styles'
import { AssistantEmojiGroupPickerModal } from './AssistantEmojiGroupPickerModal'

export interface AssistantEditEmojiSectionProps {
  emojiConfig: EmojiToolConfig
  emojiEnabled: boolean
  selectedGroupIds: string[]
  onEmojiEnabledChange: (enabled: boolean) => void
  onToggleGroup: (groupId: string) => void
  onEmojiConfigChange: (config: EmojiToolConfig) => void
  onPickAndImport: () => Promise<
    {
      relativePath: string
      originalName: string
      error: string | null
    }[]
  >
  onResolvePath: (relativePath: string) => Promise<string>
  onDelete: (relativePath: string) => Promise<boolean>
}

export const AssistantEditEmojiSection: React.FC<AssistantEditEmojiSectionProps> = ({
  emojiConfig,
  emojiEnabled,
  selectedGroupIds,
  onEmojiEnabledChange,
  onToggleGroup,
  onEmojiConfigChange,
  onPickAndImport,
  onResolvePath,
  onDelete
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
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
    <SettingsGroupCard>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[settingsCardStyles.label, { color: colors.textPrimary }]}>
            {t('agent.assistant.emoji_enabled_label', '表情组')}
          </Text>
          <Text style={[settingsCardStyles.hint, { color: colors.textSecondary, marginTop: 4 }]}>
            {t(
              'agent.assistant.emoji_enabled_desc',
              '开启后，该伙伴可在对话中使用你为其选择的表情包组'
            )}
          </Text>
        </View>
        <Switch value={emojiEnabled} onValueChange={onEmojiEnabledChange} />
      </View>

      {emojiEnabled ? (
        <>
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <TouchableOpacity
            style={styles.trigger}
            onPress={() => setPickerOpen(true)}
            activeOpacity={0.75}
          >
            <View
              style={[styles.pickSectionIconWrap, { backgroundColor: colors.primaryContainer }]}
            >
              <Smile size={18} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.groupName, { color: colors.textPrimary }]}>
                {t('agent.assistant.emoji_groups_pick_label', '可用的表情包组')}
              </Text>
              <Text style={[styles.groupMeta, { color: colors.textSecondary }]} numberOfLines={2}>
                {summary}
              </Text>
            </View>
            <ChevronRight
              size={18}
              color={colors.textTertiary}
              strokeWidth={DEFAULT_STROKE_WIDTH}
            />
          </TouchableOpacity>
        </>
      ) : null}

      <AssistantEmojiGroupPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        emojiConfig={emojiConfig}
        selectedGroupIds={selectedGroupIds}
        onToggleGroup={onToggleGroup}
        onEmojiConfigChange={onEmojiConfigChange}
        onPickAndImport={onPickAndImport}
        onResolvePath={onResolvePath}
        onDelete={onDelete}
      />
    </SettingsGroupCard>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  pickSectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  groupName: { fontSize: 15, fontWeight: '600' },
  groupMeta: { fontSize: 13, marginTop: 2 }
})
