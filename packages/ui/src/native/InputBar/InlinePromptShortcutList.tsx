import React, { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { View, Text, Pressable, FlatList, StyleSheet, Platform } from 'react-native'
import Animated, { Easing, Keyframe } from 'react-native-reanimated'
import type { PromptShortcut } from '@baishou/shared'
import {
  getShortcutCommand,
  getDefaultShortcutLabelsFromT,
  isProtectedSkill,
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
/** 退场动画结束后再释放占位，留一点余量避免 JS 定时器抢在 UI 线程动画前触发 */
const INLINE_SHORTCUT_HEIGHT_RESET_MS = INLINE_SHORTCUT_EXIT_MS + 32

const listHeightForCount = (count: number): number => {
  if (count === 0) return EMPTY_LIST_HEIGHT
  return Math.min(count * ROW_HEIGHT, LIST_MAX_HEIGHT)
}

/**
 * 面板打开时父级需要预留的高度（含面板与输入区之间的间距）。
 * 必须在渲染面板的同一帧算出，不能等子组件 layout 回调，否则首帧会先叠在输入区上再跳上去。
 */
export function resolveInlinePromptShortcutPanelHeight(shortcutCount: number): number {
  return HEADER_BLOCK_HEIGHT + listHeightForCount(shortcutCount) + INLINE_SHORTCUT_PANEL_GAP
}

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
  builtinLabel?: string
  colors: ReturnType<typeof useNativeTheme>['colors']
}

const ShortcutRow = memo(function ShortcutRow({
  shortcut,
  selected,
  onSelect,
  command,
  builtinLabel,
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
        <View style={styles.commandRow}>
          <Text style={[styles.command, { color: colors.textPrimary }]} numberOfLines={1}>
            {command}
          </Text>
          {builtinLabel ? (
            <View
              style={[
                styles.builtinBadge,
                { backgroundColor: colors.primaryContainer || colors.bgSurfaceHigh }
              ]}
            >
              <Text style={[styles.builtinBadgeText, { color: colors.primary }]}>
                {builtinLabel}
              </Text>
            </View>
          ) : null}
        </View>
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

  const listHeight = useMemo(
    () => listHeightForCount(displayShortcuts.length),
    [displayShortcuts.length]
  )

  const panelBodyHeight = HEADER_BLOCK_HEIGHT + listHeight

  useLayoutEffect(() => {
    if (visible) {
      onHeightChangeRef.current?.(panelBodyHeight + INLINE_SHORTCUT_PANEL_GAP)
      return
    }
    // 退场期间先保留占位，避免关闭时输入区上跳；打开时高度在 layout 阶段同步，面板直接锚在输入区上方
    const timer = setTimeout(() => {
      onHeightChangeRef.current?.(0)
    }, INLINE_SHORTCUT_HEIGHT_RESET_MS)
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
        scrollEnabled={true}
        bounces={Platform.OS === 'ios'}
        overScrollMode="auto"
        showsVerticalScrollIndicator={displayShortcuts.length * ROW_HEIGHT > LIST_MAX_HEIGHT}
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
          const isBuiltin = item.source !== 'workspace' && isProtectedSkill(item)
          return (
            <ShortcutRow
              shortcut={localized}
              selected={index === displaySelectedIndex}
              onSelect={onSelect}
              command={getShortcutCommand(localized)}
              builtinLabel={isBuiltin ? t('shortcut.builtin_tag', '内置') : undefined}
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
    // 面板绝对定位在外层预留的 paddingTop 区域内，关闭时父级布局不变，避免退场动画被一起带下去
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
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
      default: {
        elevation: 8
      }
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
  commandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  command: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    flexShrink: 1
  },
  builtinBadge: {
    paddingHorizontal: sharedTokens.spacing.xs,
    paddingVertical: 1,
    borderRadius: sharedTokens.radius.xs
  },
  builtinBadgeText: {
    fontSize: mobileTypography.caption.fontSize,
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
