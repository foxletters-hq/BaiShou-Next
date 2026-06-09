import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import emojiData from 'emoji-picker-element-data/en/cldr/data.json'

export interface EmojiPickerProps {
  visible: boolean
  onClose: () => void
  onSelect: (emoji: string) => void
  recentEmojis?: string[]
}

type EmojiRecord = {
  emoji: string
  annotation: string
  tags: string[]
  group: number
  order: number
}

/** 与 emoji-picker-element 桌面端底部分类 Tab 一致（跳过 group 2 肤色组件） */
const EMOJI_CATEGORY_TABS: Array<{
  id: number
  icon: string
  labelKey: string
  fallback: string
}> = [
  { id: 0, icon: '😀', labelKey: 'emoji.category_smileys', fallback: '表情与情绪' },
  { id: 1, icon: '👋', labelKey: 'emoji.category_people', fallback: '人物与身体' },
  { id: 3, icon: '🐱', labelKey: 'emoji.category_animals', fallback: '动物与自然' },
  { id: 4, icon: '🍎', labelKey: 'emoji.category_food', fallback: '食物与饮料' },
  { id: 5, icon: '🏠️', labelKey: 'emoji.category_travel', fallback: '旅行与地点' },
  { id: 6, icon: '⚽', labelKey: 'emoji.category_activities', fallback: '活动' },
  { id: 7, icon: '📝', labelKey: 'emoji.category_objects', fallback: '物品' },
  { id: 8, icon: '⛔️', labelKey: 'emoji.category_symbols', fallback: '符号' },
  { id: 9, icon: '🏁', labelKey: 'emoji.category_flags', fallback: '旗帜' }
]

const ALL_EMOJIS = (emojiData as EmojiRecord[]).filter((e) => e.emoji && e.group !== 2)

function groupEmojis(records: EmojiRecord[]): Record<number, string[]> {
  const map: Record<number, string[]> = {}
  for (const item of records) {
    if (item.group === 2) continue
    if (!map[item.group]) map[item.group] = []
    map[item.group]!.push(item.emoji)
  }
  return map
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  visible,
  onClose,
  onSelect,
  recentEmojis = []
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState(0)

  const displayRecent = useMemo(
    () => recentEmojis.filter((e) => e && e.trim()).slice(0, 12),
    [recentEmojis]
  )

  const grouped = useMemo(() => groupEmojis(ALL_EMOJIS), [])

  const filteredEmojis = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return grouped[activeGroup] || []
    return ALL_EMOJIS.filter(
      (e) =>
        e.annotation.toLowerCase().includes(q) ||
        e.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        e.emoji.includes(q)
    ).map((e) => e.emoji)
  }, [searchQuery, activeGroup, grouped])

  if (!visible) return null

  const numColumns = 8
  const isSearching = searchQuery.trim().length > 0
  const activeTabIndex = EMOJI_CATEGORY_TABS.findIndex((tab) => tab.id === activeGroup)

  const renderEmojiCell = (emoji: string) => (
    <Pressable
      key={emoji}
      style={({ pressed }) => [
        styles.emojiCell,
        {
          backgroundColor: pressed ? colors.bgSurfaceNormal : 'transparent',
          borderRadius: tokens.radius.md
        }
      ]}
      onPress={() => {
        onSelect(emoji)
        onClose()
      }}
    >
      <Text style={styles.emojiText}>{emoji}</Text>
    </Pressable>
  )

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <SafeAreaView style={styles.safeArea}>
          <Pressable
            style={[
              styles.modalContent,
              {
                width: '92%',
                maxWidth: maxModalWidth,
                backgroundColor: colors.bgSurface,
                borderRadius: tokens.radius.xl
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.header, { paddingHorizontal: tokens.spacing.lg, paddingTop: tokens.spacing.lg }]}>
              <Text style={[styles.headerText, { color: colors.textPrimary }]}>
                {t('emoji.picker_title', '选择表情')}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: tokens.spacing.lg, paddingBottom: 10 }}>
              <Input
                placeholder={t('emoji.search', '搜索')}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                leftSlot={
                  <MaterialIcons name="search" size={18} color={colors.textTertiary} />
                }
                rightSlot={
                  searchQuery.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <MaterialIcons name="close" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  ) : undefined
                }
              />
            </View>

            <View style={styles.body}>
              {!isSearching && displayRecent.length > 0 && activeGroup === 0 ? (
                <View style={[styles.recentSection, { paddingHorizontal: tokens.spacing.lg }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {t('emoji.recent', '最近使用')}
                  </Text>
                  <View style={styles.emojiRow}>{displayRecent.map(renderEmojiCell)}</View>
                </View>
              ) : null}

              <FlatList
                data={filteredEmojis}
                keyExtractor={(item, index) => `${item}-${index}`}
                numColumns={numColumns}
                renderItem={({ item }) => renderEmojiCell(item)}
                style={styles.emojiGrid}
                contentContainerStyle={[
                  styles.emojiGridContent,
                  { paddingHorizontal: tokens.spacing.lg }
                ]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {t('emoji.search_results', '无匹配表情')}
                  </Text>
                }
              />
            </View>

            {!isSearching ? (
              <View
                style={[
                  styles.categoryNav,
                  {
                    borderTopColor: colors.borderSubtle,
                    backgroundColor: colors.bgSurface
                  }
                ]}
              >
                <View
                  style={[
                    styles.categoryIndicator,
                    {
                      backgroundColor: colors.primary,
                      width: `${100 / EMOJI_CATEGORY_TABS.length}%`,
                      left: `${(Math.max(activeTabIndex, 0) * 100) / EMOJI_CATEGORY_TABS.length}%`
                    }
                  ]}
                />
                <View style={styles.categoryRow}>
                  {EMOJI_CATEGORY_TABS.map((tab) => {
                    const active = tab.id === activeGroup
                    return (
                      <TouchableOpacity
                        key={tab.id}
                        onPress={() => setActiveGroup(tab.id)}
                        style={[
                          styles.categoryTab,
                          {
                            backgroundColor: active ? colors.primaryContainer : 'transparent'
                          }
                        ]}
                        accessibilityLabel={t(tab.labelKey, tab.fallback)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={styles.categoryIcon}>{tab.icon}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            ) : null}
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  safeArea: {
    width: '100%',
    alignItems: 'center'
  },
  modalContent: {
    height: '76%',
    maxHeight: 560,
    minHeight: 440,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10
  },
  headerText: {
    fontSize: 17,
    fontWeight: '700'
  },
  body: {
    flex: 1,
    minHeight: 0
  },
  recentSection: {
    paddingBottom: 8
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  emojiGrid: {
    flex: 1
  },
  emojiGridContent: {
    paddingBottom: 12
  },
  emojiCell: {
    width: '12.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emojiText: {
    fontSize: 26
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 14
  },
  categoryNav: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 4,
    position: 'relative'
  },
  categoryIndicator: {
    position: 'absolute',
    top: 0,
    height: 3,
    borderRadius: 2
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
    paddingBottom: 4,
    minHeight: 48
  },
  categoryTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 10
  },
  categoryIcon: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center'
  }
})
