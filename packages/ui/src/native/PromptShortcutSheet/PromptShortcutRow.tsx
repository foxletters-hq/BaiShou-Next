import React, { useRef, useState } from 'react'
import { View, Text, Pressable, Dimensions } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { MoreVertical } from 'lucide-react-native'
import { type LocalizedShortcutLabels, type PromptShortcut } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { ContextMenu } from '../ContextMenu'
import { computeAnchoredMenuPosition } from '../ContextMenu/anchored-menu-position.util'
import { promptShortcutSheetStyles as styles } from './prompt-shortcut-sheet.styles'
import { resolveShortcutDisplayInfo } from './prompt-shortcut-display.util'

const ROW_MIN_HEIGHT = 64
/** 点按使用、按住拖动；略短于系统默认长按，避免第二次拖动发闷 */
const DRAG_LONG_PRESS_MS = 200

export { resolveShortcutDisplayInfo }

export const PromptShortcutRow = React.memo(function PromptShortcutRow(props: {
  item: PromptShortcut
  canManage: boolean
  canDrag: boolean
  isDragging?: boolean
  isDark?: boolean
  colors: {
    bgSurface?: string
    bgSurfaceRaised?: string
    bgSurfaceHigh: string
    borderSubtle: string
    borderMuted?: string
    textPrimary: string
    textSecondary: string
    textTertiary: string
    textOnPrimary: string
    primary: string
    primaryContainer?: string
    error: string
  }
  defaultShortcutLabels: LocalizedShortcutLabels
  onSelect: (shortcut: PromptShortcut) => void
  onEdit: (item: PromptShortcut) => void
  onDelete: (id: string) => void
  onDrag?: () => void
}) {
  const { t } = useTranslation()
  const { item, colors, isDark = false } = props
  const moreRef = useRef<View>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [anchorPosition, setAnchorPosition] = useState({ x: 0, y: 0 })

  const { localized, isProtected, command, showCustomName, customName, displayDesc } =
    resolveShortcutDisplayInfo(item, props.defaultShortcutLabels)

  const cardBg = isDark ? colors.bgSurfaceRaised || colors.bgSurface : colors.bgSurface
  const cardBorder = colors.borderMuted || colors.borderSubtle
  const canStartDrag = props.canManage && props.canDrag && Boolean(props.onDrag)
  const dragStartedRef = useRef(false)

  const startDrag = () => {
    dragStartedRef.current = true
    props.onDrag?.()
  }

  const handlePress = () => {
    if (dragStartedRef.current) return
    props.onSelect(localized)
  }

  const handlePressOut = () => {
    requestAnimationFrame(() => {
      dragStartedRef.current = false
    })
  }

  const openMenu = () => {
    moreRef.current?.measureInWindow((x, y, width, height) => {
      const window = Dimensions.get('window')
      const next = computeAnchoredMenuPosition({
        triggerX: x,
        triggerY: y,
        triggerWidth: width,
        triggerHeight: height,
        windowWidth: window.width,
        windowHeight: window.height
      })
      setAnchorPosition({ x: next.left, y: next.top })
      setMenuOpen(true)
    })
  }

  const body = (
    <>
      <View style={styles.itemTitleRow}>
        <Text style={[styles.itemCommand, { color: colors.primary }]} numberOfLines={1}>
          /{command}
        </Text>
        {showCustomName ? (
          <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>
            {customName}
          </Text>
        ) : null}
        {isProtected ? (
          <View
            style={[
              styles.systemBadge,
              {
                backgroundColor: colors.primaryContainer || colors.bgSurfaceHigh
              }
            ]}
          >
            <Text style={[styles.systemBadgeText, { color: colors.primary }]}>
              {t('shortcut.builtin_tag', '内置')}
            </Text>
          </View>
        ) : null}
      </View>
      {displayDesc ? (
        <Text style={[styles.itemContent, { color: colors.textSecondary }]} numberOfLines={2}>
          {displayDesc}
        </Text>
      ) : null}
    </>
  )

  return (
    <View
      style={[
        styles.item,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
          minHeight: ROW_MIN_HEIGHT
        }
      ]}
    >
      <View style={styles.itemBody}>
        <TouchableOpacity
          style={styles.itemBodyPress}
          onPress={handlePress}
          onPressOut={handlePressOut}
          onLongPress={canStartDrag ? startDrag : undefined}
          delayLongPress={DRAG_LONG_PRESS_MS}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel={`/${command}`}
        >
          {body}
        </TouchableOpacity>
      </View>

      {props.canManage && !isProtected ? (
        <View style={styles.itemActions}>
          <View ref={moreRef} collapsable={false}>
            <Pressable
              style={styles.moreBtn}
              hitSlop={8}
              onPress={openMenu}
              accessibilityLabel={t('common.more', '更多操作')}
            >
              <MoreVertical
                size={18}
                color={colors.textSecondary}
                strokeWidth={DEFAULT_STROKE_WIDTH}
              />
            </Pressable>
          </View>
          <ContextMenu
            visible={menuOpen}
            onClose={() => setMenuOpen(false)}
            anchorPosition={anchorPosition}
            items={[
              {
                label: t('shortcut.edit', '编辑'),
                onPress: () => props.onEdit(item)
              },
              {
                label: t('common.delete', '删除'),
                onPress: () => props.onDelete(item.id),
                destructive: true
              }
            ]}
          />
        </View>
      ) : null}
    </View>
  )
})
