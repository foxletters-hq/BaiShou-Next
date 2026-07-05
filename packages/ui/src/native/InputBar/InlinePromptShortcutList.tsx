import React, { memo, useEffect, useRef } from 'react'
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native'
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

const shortcutEnter = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ translateY: 10 }]
  },
  100: {
    opacity: 1,
    transform: [{ translateY: 0 }],
    easing: Easing.out(Easing.cubic)
  }
}).duration(180)

const shortcutExit = new Keyframe({
  0: {
    opacity: 1,
    transform: [{ translateY: 0 }]
  },
  100: {
    opacity: 0,
    transform: [{ translateY: 8 }],
    easing: Easing.in(Easing.cubic)
  }
}).duration(150)

export interface InlinePromptShortcutListProps {
  visible: boolean
  shortcuts: PromptShortcut[]
  selectedIndex: number
  onSelect: (shortcut: PromptShortcut) => void
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
  onSelect
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const labels = getDefaultShortcutLabelsFromT(t)
  const snapshotRef = useRef({ shortcuts, selectedIndex })

  if (visible) {
    snapshotRef.current = { shortcuts, selectedIndex }
  }

  const { shortcuts: displayShortcuts, selectedIndex: displaySelectedIndex } = snapshotRef.current
  const listRef = useRef<FlatList<PromptShortcut>>(null)

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
          backgroundColor: colors.bgSurfaceHigh,
          borderColor: colors.borderMuted
        }
      ]}
      pointerEvents="auto"
    >
      <Text style={[styles.header, { color: colors.textSecondary }]}>
        {t('shortcut.title', '快捷指令')}
      </Text>
      <FlatList
        ref={listRef}
        data={displayShortcuts}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.listContent}
        nestedScrollEnabled
        bounces
        overScrollMode="always"
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
    left: 0,
    right: 0,
    bottom: '100%',
    marginBottom: 8,
    zIndex: 30,
    elevation: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: PANEL_MAX_HEIGHT,
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
  list: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: LIST_MAX_HEIGHT
  },
  listContent: {
    paddingBottom: 6
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
