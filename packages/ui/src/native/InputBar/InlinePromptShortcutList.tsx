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
import { FolderOpen, Sparkles } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { LucideIcon } from '../icons/LucideIcon'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

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
  hasChatBackground?: boolean
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
      <LucideIcon
        icon={shortcut.source === 'workspace' ? FolderOpen : Sparkles}
        size={16}
        color={colors.textSecondary}
      />
      <View style={styles.meta}>
        <Text style={[styles.command, { color: colors.textPrimary }]} numberOfLines={1}>
          {command}
        </Text>
        {shortcut.description || shortcut.name ? (
          <Text style={[styles.name, { color: colors.textSecondary }]} numberOfLines={1}>
            {shortcut.description || shortcut.name}
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
  onHeightChange,
  hasChatBackground = false
}) => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
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
          backgroundColor: hasChatBackground
            ? isDark
              ? 'rgba(30, 30, 34, 0.92)'
              : 'rgba(255, 255, 255, 0.94)'
            : colors.bgSurface,
          borderColor: hasChatBackground
            ? isDark
              ? 'rgba(255, 255, 255, 0.15)'
              : 'rgba(0, 0, 0, 0.10)'
            : colors.borderMuted,
          height: panelBodyHeight
        }
      ]}
      pointerEvents="auto"
      collapsable={false}
    >
      <Text style={[styles.header, { color: colors.textSecondary }]}>
        {t('shortcut.skill_picker_title', 'Skill')}
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
            {t('shortcut.no_skill_match', '找不到匹配的 Skill')}
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
    borderRadius: sharedTokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'column',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16
      },
      default: {}
    })
  },
  header: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingTop: sharedTokens.spacing.smPlus,
    paddingBottom: sharedTokens.spacing.xsPlus
  },
  listContent: {
    paddingBottom: sharedTokens.spacing.xsPlus
  },
  row: {
    height: ROW_HEIGHT - 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    borderWidth: 1,
    borderRadius: sharedTokens.radius.control,
    marginHorizontal: sharedTokens.spacing.sm,
    marginBottom: sharedTokens.spacing.xsPlus
  },
  meta: {
    flex: 1,
    minWidth: 0
  },
  command: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  name: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xxs
  },
  empty: {
    fontSize: mobileTypography.caption.fontSize,
    textAlign: 'center',
    paddingVertical: sharedTokens.spacing.md
  }
})
