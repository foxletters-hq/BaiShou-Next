import React, { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { View, Text, Pressable, FlatList, StyleSheet, Platform } from 'react-native'
import Animated, { Easing, Keyframe } from 'react-native-reanimated'
import type { PromptShortcut } from '@baishou/shared'
import {
  getShortcutCommand,
  getDefaultShortcutLabelsFromT,
  localizePromptShortcut
} from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

const PANEL_MAX_HEIGHT = 220
const HEADER_BLOCK_HEIGHT = 32
const LIST_MAX_HEIGHT = PANEL_MAX_HEIGHT - HEADER_BLOCK_HEIGHT
const ROW_HEIGHT = 56
const EMPTY_LIST_HEIGHT = 48
/** 面板与输入区分隔线之间的间距 */
export const INLINE_SHORTCUT_PANEL_GAP = 8
export const INLINE_SHORTCUT_ENTER_MS = 180
export const INLINE_SHORTCUT_EXIT_MS = 150

const shortcutEnter = new Keyframe({
  0: {
    opacity: 0
  },
  100: {
    opacity: 1,
    easing: Easing.out(Easing.cubic)
  }
}).duration(INLINE_SHORTCUT_ENTER_MS)

const shortcutExit = new Keyframe({
  0: {
    opacity: 1
  },
  100: {
    opacity: 0,
    easing: Easing.in(Easing.cubic)
  }
}).duration(INLINE_SHORTCUT_EXIT_MS)

export interface InlinePromptShortcutListProps {
  visible: boolean
  shortcuts: PromptShortcut[]
  selectedIndex: number
  onSelect: (shortcut: PromptShortcut) => void
  /** 面板实际高度（含间距），供外层预留下方分割线位置不变的触摸区 */
  onHeightChange?: (height: number) => void
}

type ShortcutRowProps = {
  shortcut: PromptShortcut
  selected: boolean
  onSelect: (shortcut: PromptShortcut) => void
  command: string
  colors: ReturnType<typeof useNativeTheme>['colors']
}

const ShortcutRow = memo(function ShortcutRow({
  shortcut,
  selected,
  onSelect,
  command,
  colors
}: ShortcutRowProps) {
  return (
    <Pressable
      onPress={() => onSelect(shortcut)}
      style={[
        styles.row,
        {
          backgroundColor: selected ? colors.primaryContainer : 'transparent',
          borderColor: selected ? colors.primary : 'transparent'
        }
      ]}
    >
      <Text style={styles.icon}>{shortcut.icon || '⚡'}</Text>
      <View style={styles.meta}>
        <Text style={[styles.command, { color: colors.textPrimary }]}>/{command}</Text>
        {shortcut.name ? (
          <Text style={[styles.name, { color: colors.textSecondary }]} numberOfLines={1}>
            {shortcut.name}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
})

export const InlinePromptShortcutList: React.FC<InlinePromptShortcutListProps> = ({
  visible,
  shortcuts,
  selectedIndex,
  onSelect,
  onHeightChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const labels = getDefaultShortcutLabelsFromT(t)
  const snapshotRef = useRef({ shortcuts, selectedIndex })
  const onHeightChangeRef = useRef(onHeightChange)
  onHeightChangeRef.current = onHeightChange

  if (visible) {
    snapshotRef.current = { shortcuts, selectedIndex }
  }

  const { shortcuts: displayShortcuts, selectedIndex: displaySelectedIndex } = snapshotRef.current
  const listRef = useRef<FlatList<PromptShortcut>>(null)

  const listHeight = useMemo(() => {
    if (displayShortcuts.length === 0) return EMPTY_LIST_HEIGHT
    return Math.min(displayShortcuts.length * ROW_HEIGHT, LIST_MAX_HEIGHT)
  }, [displayShortcuts.length])

  const panelBodyHeight = HEADER_BLOCK_HEIGHT + listHeight

  useLayoutEffect(() => {
    if (visible) {
      onHeightChangeRef.current?.(panelBodyHeight + INLINE_SHORTCUT_PANEL_GAP)
      return
    }
    // 退场期间先保留占位，避免关闭时输入区上跳；打开时高度在 layout 阶段同步，面板直接锚在输入区上方
    const timer = setTimeout(() => {
      onHeightChangeRef.current?.(0)
    }, INLINE_SHORTCUT_EXIT_MS)
    return () => clearTimeout(timer)
  }, [visible, panelBodyHeight])

  useEffect(() => {
    if (!visible || displayShortcuts.length === 0 || displaySelectedIndex < 0) return
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: displaySelectedIndex,
        viewPosition: 0.5,
        animated: true
      })
    })
  }, [visible, displaySelectedIndex, displayShortcuts.length])

  return visible ? (
    <Animated.View
      entering={shortcutEnter}
      exiting={shortcutExit}
      style={[
        styles.overlay,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderMuted,
          height: panelBodyHeight
        }
      ]}
      pointerEvents="auto"
      collapsable={false}
    >
      <Text style={[styles.header, { color: colors.textSecondary }]}>
        {t('shortcut.title', '快捷指令')}
      </Text>
      <FlatList
        ref={listRef}
        data={displayShortcuts}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        style={{ height: listHeight }}
        contentContainerStyle={styles.listContent}
        nestedScrollEnabled
        scrollEnabled={displayShortcuts.length * ROW_HEIGHT > LIST_MAX_HEIGHT}
        bounces={Platform.OS === 'ios'}
        overScrollMode="never"
        showsVerticalScrollIndicator={displayShortcuts.length > 4}
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT,
          offset: ROW_HEIGHT * index,
          index
        })}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true
          })
        }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textTertiary }]}>
            {t('shortcut.no_match', '找不到任何匹配的快捷指令...')}
          </Text>
        }
        renderItem={({ item, index }) => {
          const localized = localizePromptShortcut(item, labels)
          return (
            <ShortcutRow
              shortcut={localized}
              selected={index === displaySelectedIndex}
              onSelect={onSelect}
              command={getShortcutCommand(localized)}
              colors={colors}
            />
          )
        }}
      />
    </Animated.View>
  ) : null
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: '100%',
    marginBottom: INLINE_SHORTCUT_PANEL_GAP,
    zIndex: 30,
    elevation: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6
  },
  listContent: {
    paddingBottom: 6
  },
  row: {
    height: ROW_HEIGHT - 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 8,
    marginBottom: 6
  },
  icon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center'
  },
  meta: {
    flex: 1,
    minWidth: 0
  },
  command: {
    fontSize: 14,
    fontWeight: '700'
  },
  name: {
    fontSize: 12,
    marginTop: 2
  },
  empty: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16
  }
})
