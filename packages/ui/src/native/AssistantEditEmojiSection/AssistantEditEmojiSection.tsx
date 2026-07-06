import React, { useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { Check, Smile } from 'lucide-react-native'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
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
  /** 内层列表滚动时锁定外层页面滚动，避免嵌套 ScrollView 联动 */
  onLockOuterScroll?: (locked: boolean) => void
}

const EMOJI_GROUP_ROW_HEIGHT = 62
const EMOJI_GROUP_ROW_GAP = 8
const EMOJI_GROUP_VISIBLE_MAX = 3
const emojiGroupListMaxHeight =
  EMOJI_GROUP_VISIBLE_MAX * EMOJI_GROUP_ROW_HEIGHT +
  (EMOJI_GROUP_VISIBLE_MAX - 1) * EMOJI_GROUP_ROW_GAP

export const AssistantEditEmojiSection: React.FC<AssistantEditEmojiSectionProps> = ({
  emojiGroups,
  emojiEnabled,
  selectedGroupIds,
  onEmojiEnabledChange,
  onToggleGroup,
  onLockOuterScroll
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const canScrollList = emojiGroups.length > EMOJI_GROUP_VISIBLE_MAX

  const handleListScrollBegin = useCallback(() => {
    if (canScrollList) onLockOuterScroll?.(true)
  }, [canScrollList, onLockOuterScroll])

  const handleListScrollEnd = useCallback(() => {
    onLockOuterScroll?.(false)
  }, [onLockOuterScroll])

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
          <View style={styles.pickLabelRow}>
            <View
              style={[styles.pickSectionIconWrap, { backgroundColor: colors.primaryContainer }]}
            >
              <Smile size={16} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            </View>
            <Text style={[settingsCardStyles.label, { color: colors.textPrimary, flex: 1 }]}>
              {t('agent.assistant.emoji_groups_pick_label', '可用的表情包组')}
            </Text>
          </View>
          <View style={{ height: 8 }} />
          {emojiGroups.length === 0 ? (
            <Text style={[settingsCardStyles.hint, { color: colors.textSecondary }]}>
              {t('agent.tools.emoji_no_groups', '请先在表情包设置中创建表情包组')}
            </Text>
          ) : (
            <ScrollView
              style={[styles.groupList, canScrollList ? { height: emojiGroupListMaxHeight } : null]}
              contentContainerStyle={styles.groupListContent}
              nestedScrollEnabled
              scrollEnabled={canScrollList}
              bounces={canScrollList}
              overScrollMode={canScrollList ? 'always' : 'never'}
              showsVerticalScrollIndicator={canScrollList}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={handleListScrollBegin}
              onScrollEndDrag={handleListScrollEnd}
              onMomentumScrollEnd={handleListScrollEnd}
            >
              {emojiGroups.map((group, index) => {
                const selected = selectedGroupIds.includes(group.id)
                return (
                  <View key={group.id}>
                    {index > 0 ? <View style={{ height: EMOJI_GROUP_ROW_GAP }} /> : null}
                    <TouchableOpacity
                      style={[
                        styles.groupRow,
                        {
                          borderColor: selected ? colors.primary : colors.borderMuted,
                          borderWidth: selected ? 2 : 1.5,
                          backgroundColor: selected ? colors.primaryContainer : colors.bgSurface
                        }
                      ]}
                      onPress={() => onToggleGroup(group.id)}
                      activeOpacity={0.75}
                    >
                      <View
                        style={[styles.groupIconWrap, { backgroundColor: colors.primaryContainer }]}
                      >
                        <Smile
                          size={18}
                          color={colors.primary}
                          strokeWidth={DEFAULT_STROKE_WIDTH}
                        />
                      </View>
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
                  </View>
                )
              })}
            </ScrollView>
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
  pickLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  pickSectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center'
  },
  groupListContent: {
    paddingBottom: 0
  },
  groupList: {
    flexGrow: 0
  },
  groupIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: EMOJI_GROUP_ROW_HEIGHT,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10
  },
  groupName: { fontSize: 15, fontWeight: '600' },
  groupMeta: { fontSize: 13, marginTop: 2 }
})
