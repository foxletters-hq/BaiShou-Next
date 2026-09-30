import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { GripVertical, Pencil, Trash2 } from 'lucide-react-native'
import {
  localizePromptShortcut,
  type LocalizedShortcutLabels,
  type PromptShortcut
} from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { promptShortcutSheetStyles as styles } from './prompt-shortcut-sheet.styles'

const ROW_MIN_HEIGHT = 60

export function PromptShortcutRow(props: {
  item: PromptShortcut
  canManage: boolean
  canDrag: boolean
  isDragging?: boolean
  colors: {
    bgSurfaceHigh: string
    borderSubtle: string
    textPrimary: string
    textSecondary: string
    textTertiary: string
    textOnPrimary: string
    primary: string
    error: string
  }
  defaultShortcutLabels: LocalizedShortcutLabels
  onSelect: (shortcut: PromptShortcut) => void
  onEdit: (item: PromptShortcut) => void
  onDelete: (id: string) => void
  onDrag?: () => void
}) {
  const { t } = useTranslation()
  const { item, colors } = props
  const localized = localizePromptShortcut(item, props.defaultShortcutLabels)

  return (
    <View
      style={[
        styles.item,
        {
          backgroundColor: colors.bgSurfaceHigh,
          borderColor: colors.borderSubtle,
          minHeight: ROW_MIN_HEIGHT,
          opacity: props.isDragging ? 0.92 : 1
        }
      ]}
    >
      {props.canManage ? (
        props.canDrag && props.onDrag ? (
          <Pressable
            style={styles.reorderBtns}
            onPressIn={props.onDrag}
            hitSlop={6}
            accessibilityLabel={t('shortcut.drag_handle', '拖动排序')}
          >
            <GripVertical
              size={22}
              color={colors.textTertiary}
              strokeWidth={DEFAULT_STROKE_WIDTH}
            />
          </Pressable>
        ) : (
          <View style={styles.reorderSpacer} />
        )
      ) : null}

      <View style={styles.itemBody}>
        <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>
          {localized.name || t('shortcut.default_tag', '指令')}
        </Text>
        <Text style={[styles.itemContent, { color: colors.textSecondary }]} numberOfLines={2}>
          {localized.content}
        </Text>
      </View>

      <View style={styles.itemActions}>
        <Pressable
          style={[styles.useBtn, { backgroundColor: colors.primary }]}
          onPress={() => props.onSelect(localized)}
          accessibilityLabel={t('common.use', '使用')}
        >
          <Text style={{ color: colors.textOnPrimary, fontWeight: '600', fontSize: 12 }}>
            {t('common.use', '使用')}
          </Text>
        </Pressable>
        {props.canManage ? (
          <>
            <Pressable
              style={styles.actionBtn}
              hitSlop={8}
              onPress={() => props.onEdit(item)}
              accessibilityLabel={t('shortcut.edit', '编辑')}
            >
              <Pencil size={20} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              hitSlop={8}
              onPress={() => props.onDelete(item.id)}
              accessibilityLabel={t('common.delete', '删除')}
            >
              <Trash2 size={22} color={colors.error} strokeWidth={DEFAULT_STROKE_WIDTH} />
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  )
}
