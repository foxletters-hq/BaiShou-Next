import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import type { EmojiGroup } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { SettingsGroupCard } from '../settings/SettingsGroupCard'
import { settingsCardStyles } from '../settings/settings-card.styles'

export interface AssistantEditEmojiSectionProps {
  emojiGroups: EmojiGroup[]
  emojiEnabled: boolean
  selectedGroupIds: string[]
  onEmojiEnabledChange: (enabled: boolean) => void
  onToggleGroup: (groupId: string) => void
}

export const AssistantEditEmojiSection: React.FC<AssistantEditEmojiSectionProps> = ({
  emojiGroups,
  emojiEnabled,
  selectedGroupIds,
  onEmojiEnabledChange,
  onToggleGroup
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

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
          <Text style={[settingsCardStyles.label, { color: colors.textPrimary, marginBottom: 8 }]}>
            {t('agent.assistant.emoji_groups_pick_label', '可用的表情包组')}
          </Text>
          {emojiGroups.length === 0 ? (
            <Text style={[settingsCardStyles.hint, { color: colors.textSecondary }]}>
              {t('agent.tools.emoji_no_groups', '请先在表情包设置中创建表情包组')}
            </Text>
          ) : (
            emojiGroups.map((group) => {
              const selected = selectedGroupIds.includes(group.id)
              return (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.groupRow,
                    {
                      borderColor: colors.borderSubtle,
                      backgroundColor: selected ? colors.primaryContainer : colors.bgSurface
                    }
                  ]}
                  onPress={() => onToggleGroup(group.id)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.groupName, { color: colors.textPrimary }]}>
                      {group.name}
                    </Text>
                    <Text style={[styles.groupMeta, { color: colors.textSecondary }]}>
                      {t('agent.tools.emoji_group_count', '{{count}} 个表情', {
                        count: group.emojis?.length ?? 0
                      })}
                    </Text>
                  </View>
                  {selected ? (
                    <Check size={20} color={colors.primary} strokeWidth={2.5} />
                  ) : null}
                </TouchableOpacity>
              )
            })
          )}
        </>
      ) : null}
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
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8
  },
  groupName: { fontSize: 15, fontWeight: '600' },
  groupMeta: { fontSize: 13, marginTop: 2 }
})
