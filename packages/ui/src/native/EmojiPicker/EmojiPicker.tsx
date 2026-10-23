import i18n from 'i18next'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native'
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated'
import { Search, X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { logger } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { Input } from '../Input/Input'
import { SegmentedContent } from '../SegmentedControl'
import { loadEmojiCldrData, type EmojiCldrRecord } from './load-emoji-cldr-data'
import { iconSizes, mobileTypography, sharedTokens } from '../../theme/tokens'

export interface EmojiPickerProps {
  visible: boolean
  onClose: () => void
  onSelect: (emoji: string) => void
  recentEmojis?: string[]
}

/** 与 emoji-picker-element 桌面端底部分类 Tab 一致（跳过 group 2 肤色组件） */
const EMOJI_CATEGORY_TABS: Array<{
  id: number
  icon: string
  labelKey: string
  fallback: string
}> = [
  {
    id: 0,
    icon: '😀',
    labelKey: 'emoji.category_smileys',
    fallback: i18n.t('auto.packages.ui.src.native.EmojiPicker.EmojiPicker.L41', '表情与情绪')
  },
  {
    id: 1,
    icon: '👋',
    labelKey: 'emoji.category_people',
    fallback: i18n.t('auto.packages.ui.src.native.EmojiPicker.EmojiPicker.L42', '人物与身体')
  },
  {
    id: 3,
    icon: '🐱',
    labelKey: 'emoji.category_animals',
    fallback: i18n.t('auto.packages.ui.src.native.EmojiPicker.EmojiPicker.L43', '动物与自然')
  },
  {
    id: 4,
    icon: '🍎',
    labelKey: 'emoji.category_food',
    fallback: i18n.t('auto.packages.ui.src.native.EmojiPicker.EmojiPicker.L44', '食物与饮料')
  },
  {
    id: 5,
    icon: '🏠️',
    labelKey: 'emoji.category_travel',
    fallback: i18n.t('auto.packages.ui.src.native.EmojiPicker.EmojiPicker.L45', '旅行与地点')
  },
  {
    id: 6,
    icon: '⚽',
    labelKey: 'emoji.category_activities',
    fallback: i18n.t('auto.packages.ui.src.native.EmojiPicker.EmojiPicker.L46', '活动')
  },
  {
    id: 7,
    icon: '📝',
    labelKey: 'emoji.category_objects',
    fallback: i18n.t('auto.packages.ui.src.native.EmojiPicker.EmojiPicker.L47', '物品')
  },
  {
    id: 8,
    icon: '⛔️',
    labelKey: 'emoji.category_symbols',
    fallback: i18n.t('auto.packages.ui.src.native.EmojiPicker.EmojiPicker.L48', '符号')
  },
  {
    id: 9,
    icon: '🏁',
    labelKey: 'emoji.category_flags',
    fallback: i18n.t('auto.packages.ui.src.native.EmojiPicker.EmojiPicker.L49', '旗帜')
  }
]

function groupEmojis(records: EmojiCldrRecord[]): Record<number, string[]> {
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
  const [records, setRecords] = useState<EmojiCldrRecord[] | null>(null)

  useEffect(() => {
    let cancelled = false
    if (visible) {
      void loadEmojiCldrData()
        .then((data) => {
          if (!cancelled) setRecords(data)
        })
        .catch((error: unknown) => {
          logger.warn('Failed to load emoji picker data', error as Error)
          if (!cancelled) setRecords([])
        })
    }
    return () => {
      cancelled = true
    }
  }, [visible])

  const displayRecent = useMemo(
    () => recentEmojis.filter((e) => e && e.trim()).slice(0, 12),
    [recentEmojis]
  )

  const allEmojis = useMemo(() => records ?? [], [records])
  const grouped = useMemo(() => groupEmojis(allEmojis), [allEmojis])
  const [categoryNavWidth, setCategoryNavWidth] = useState(0)
  const activeTabIndex = EMOJI_CATEGORY_TABS.findIndex((tab) => tab.id === activeGroup)
  const categoryTabWidth = categoryNavWidth / EMOJI_CATEGORY_TABS.length
  const categoryIndicatorOffset = useSharedValue(0)
  const hasMeasuredIndicatorRef = useRef(false)
  const categoryIndicatorStyle = useAnimatedStyle(() => ({
    width: categoryTabWidth,
    transform: [{ translateX: categoryIndicatorOffset.value }]
  }))

  useEffect(() => {
    if (categoryTabWidth <= 0 || activeTabIndex < 0) return
    const target = activeTabIndex * categoryTabWidth
    if (!hasMeasuredIndicatorRef.current) {
      categoryIndicatorOffset.value = target
      hasMeasuredIndicatorRef.current = true
      return
    }
    categoryIndicatorOffset.value = withSpring(target, {
      damping: 20,
      stiffness: 220,
      mass: 0.6
    })
  }, [activeTabIndex, categoryIndicatorOffset, categoryTabWidth])

  const filteredEmojis = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return grouped[activeGroup] || []
    return allEmojis
      .filter(
        (e) =>
          e.annotation.toLowerCase().includes(q) ||
          e.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          e.emoji.includes(q)
      )
      .map((e) => e.emoji)
  }, [searchQuery, activeGroup, grouped, allEmojis])

  if (!visible) return null

  const numColumns = 8
  const isSearching = searchQuery.trim().length > 0
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
            <View
              style={[
                styles.header,
                { paddingHorizontal: tokens.spacing.lg, paddingTop: tokens.spacing.lg }
              ]}
            >
              <Text style={[styles.headerText, { color: colors.textPrimary }]}>
                {t('emoji.picker_title', '选择表情')}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={22} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
              </TouchableOpacity>
            </View>

            <View
              style={{
                paddingHorizontal: tokens.spacing.lg,
                paddingBottom: sharedTokens.spacing.smPlus
              }}
            >
              <Input
                placeholder={t('emoji.search', '搜索')}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                leftSlot={
                  <Search
                    size={18}
                    color={colors.textTertiary}
                    strokeWidth={DEFAULT_STROKE_WIDTH}
                  />
                }
                rightSlot={
                  searchQuery.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <X size={16} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
                    </TouchableOpacity>
                  ) : undefined
                }
              />
            </View>

            <View style={styles.body}>
              {!records ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <SegmentedContent
                  value={isSearching ? 'search' : String(activeGroup)}
                  style={{ flex: 1, minHeight: 0 }}
                >
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
                </SegmentedContent>
              )}
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
                onLayout={(event) => setCategoryNavWidth(event.nativeEvent.layout.width)}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.categoryIndicator,
                    { backgroundColor: colors.primary },
                    categoryIndicatorStyle
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
                        <Animated.Text
                          key={active ? 'selected' : 'unselected'}
                          entering={
                            active ? FadeIn.duration(sharedTokens.animation.swift) : undefined
                          }
                          style={styles.categoryIcon}
                        >
                          {tab.icon}
                        </Animated.Text>
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
    paddingBottom: sharedTokens.spacing.smPlus
  },
  headerText: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600'
  },
  body: {
    flex: 1,
    minHeight: 0
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  recentSection: {
    paddingBottom: sharedTokens.spacing.sm
  },
  sectionTitle: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.xsPlus
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  emojiGrid: {
    flex: 1
  },
  emojiGridContent: {
    paddingBottom: sharedTokens.spacing.mdTight
  },
  emojiCell: {
    width: '12.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emojiText: {
    fontSize: mobileTypography.display.fontSize
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: sharedTokens.spacing.lg,
    fontSize: mobileTypography.secondary.fontSize
  },
  categoryNav: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: sharedTokens.spacing.xs,
    position: 'relative'
  },
  categoryIndicator: {
    position: 'absolute',
    top: 0,
    height: 3,
    borderRadius: sharedTokens.radius.xxs
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: sharedTokens.spacing.xsPlus,
    paddingBottom: sharedTokens.spacing.xs,
    minHeight: 48
  },
  categoryTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: sharedTokens.radius.control
  },
  categoryIcon: {
    fontSize: iconSizes.lg,
    lineHeight: 30,
    textAlign: 'center'
  }
})
