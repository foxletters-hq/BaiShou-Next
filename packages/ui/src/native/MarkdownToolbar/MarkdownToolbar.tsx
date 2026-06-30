import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  type NativeSyntheticEvent,
  type NativeScrollEvent
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../../native/theme'
import type { DiaryCmMarkdownMark } from '../../shared/diary-codemirror/types'
import { MarkdownToolbarSettingsSheet } from './MarkdownToolbarSettingsSheet'
import {
  DEFAULT_MARKDOWN_TOOLBAR_ORDER,
  type MarkdownToolbarToolId
} from './markdown-toolbar.types'

interface MarkdownToolbarProps {
  onInsertText: (prefix: string, suffix?: string) => void
  onUndo?: () => void
  onRedo?: () => void
  onToggleMark?: (marker: DiaryCmMarkdownMark) => void
  onPickImages?: () => void
  pickingImages?: boolean
  toolOrder?: MarkdownToolbarToolId[]
  onToolOrderChange?: (order: MarkdownToolbarToolId[]) => void
}

function ToolbarButton({
  onPress,
  disabled = false,
  borderColor,
  accessibilityLabel,
  children
}: {
  onPress?: () => void
  disabled?: boolean
  borderColor: string
  accessibilityLabel: string
  children: ReactNode
}) {
  return (
    <TouchableOpacity
      style={[styles.btn, { borderColor }, disabled && styles.btnDisabled]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      delayPressIn={72}
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.65}
    >
      {children}
    </TouchableOpacity>
  )
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  onInsertText,
  onUndo,
  onRedo,
  onToggleMark,
  onPickImages,
  pickingImages = false,
  toolOrder = DEFAULT_MARKDOWN_TOOLBAR_ORDER,
  onToolOrderChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [settingsVisible, setSettingsVisible] = useState(false)
  const isScrollingRef = useRef(false)
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const iconColor = colors.textSecondary
  const disabledIcon = colors.textTertiary

  const markScrollStart = useCallback(() => {
    isScrollingRef.current = true
    if (scrollEndTimerRef.current) {
      clearTimeout(scrollEndTimerRef.current)
      scrollEndTimerRef.current = null
    }
  }, [])

  const scheduleScrollEnd = useCallback(() => {
    if (scrollEndTimerRef.current) {
      clearTimeout(scrollEndTimerRef.current)
    }
    scrollEndTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false
      scrollEndTimerRef.current = null
    }, 80)
  }, [])

  const handleScrollBeginDrag = useCallback(() => {
    markScrollStart()
  }, [markScrollStart])

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const velocityX = Math.abs(event.nativeEvent.velocity?.x ?? 0)
      if (velocityX > 0.15) {
        markScrollStart()
        return
      }
      scheduleScrollEnd()
    },
    [markScrollStart, scheduleScrollEnd]
  )

  const guardPress = useCallback(
    (action?: () => void) => () => {
      if (!action || isScrollingRef.current) return
      action()
    },
    []
  )

  const renderTool = useCallback(
    (id: MarkdownToolbarToolId): ReactNode => {
      switch (id) {
        case 'undo':
          return (
            <ToolbarButton
              key={id}
              borderColor={colors.borderSubtle}
              onPress={guardPress(onUndo)}
              disabled={!onUndo}
              accessibilityLabel={t('diary.toolbar_undo', '撤销')}
            >
              <MaterialIcons name="undo" size={22} color={onUndo ? iconColor : disabledIcon} />
            </ToolbarButton>
          )
        case 'redo':
          return (
            <ToolbarButton
              key={id}
              borderColor={colors.borderSubtle}
              onPress={guardPress(onRedo)}
              disabled={!onRedo}
              accessibilityLabel={t('diary.toolbar_redo', '重做')}
            >
              <MaterialIcons name="redo" size={22} color={onRedo ? iconColor : disabledIcon} />
            </ToolbarButton>
          )
        case 'bold':
          return (
            <ToolbarButton
              key={id}
              borderColor={colors.borderSubtle}
              onPress={guardPress(() => onToggleMark?.('**'))}
              disabled={!onToggleMark}
              accessibilityLabel={t('diary.toolbar_bold', '加粗')}
            >
              <Text
                style={[
                  styles.markText,
                  { color: onToggleMark ? colors.textPrimary : disabledIcon }
                ]}
              >
                B
              </Text>
            </ToolbarButton>
          )
        case 'italic':
          return (
            <ToolbarButton
              key={id}
              borderColor={colors.borderSubtle}
              onPress={guardPress(() => onToggleMark?.('*'))}
              disabled={!onToggleMark}
              accessibilityLabel={t('diary.toolbar_italic', '斜体')}
            >
              <Text
                style={[
                  styles.markText,
                  styles.italicText,
                  { color: onToggleMark ? colors.textPrimary : disabledIcon }
                ]}
              >
                I
              </Text>
            </ToolbarButton>
          )
        case 'strikethrough':
          return (
            <ToolbarButton
              key={id}
              borderColor={colors.borderSubtle}
              onPress={guardPress(() => onToggleMark?.('~~'))}
              disabled={!onToggleMark}
              accessibilityLabel={t('diary.toolbar_strikethrough', '删除线')}
            >
              <Text
                style={[
                  styles.markText,
                  styles.strikeText,
                  { color: onToggleMark ? colors.textPrimary : disabledIcon }
                ]}
              >
                S
              </Text>
            </ToolbarButton>
          )
        case 'code':
          return (
            <ToolbarButton
              key={id}
              borderColor={colors.borderSubtle}
              onPress={guardPress(() => onToggleMark?.('`'))}
              disabled={!onToggleMark}
              accessibilityLabel={t('diary.toolbar_code', '行内代码')}
            >
              <MaterialIcons
                name="code"
                size={22}
                color={onToggleMark ? iconColor : disabledIcon}
              />
            </ToolbarButton>
          )
        case 'quote':
          return (
            <ToolbarButton
              key={id}
              borderColor={colors.borderSubtle}
              onPress={guardPress(() => onInsertText('> '))}
              accessibilityLabel={t('diary.toolbar_quote', '引用')}
            >
              <MaterialIcons name="format-quote" size={22} color={iconColor} />
            </ToolbarButton>
          )
        case 'list':
          return (
            <ToolbarButton
              key={id}
              borderColor={colors.borderSubtle}
              onPress={guardPress(() => onInsertText('- '))}
              accessibilityLabel={t('diary.toolbar_list', '无序列表')}
            >
              <MaterialIcons name="format-list-bulleted" size={22} color={iconColor} />
            </ToolbarButton>
          )
        case 'hash':
          return (
            <ToolbarButton
              key={id}
              borderColor={colors.borderSubtle}
              onPress={guardPress(() => onInsertText('#'))}
              accessibilityLabel={t('diary.toolbar_insert_tag', '插入标签')}
            >
              <Text style={[styles.hashText, { color: colors.primary }]}>#</Text>
            </ToolbarButton>
          )
        case 'h5':
          return (
            <ToolbarButton
              key={id}
              borderColor={colors.borderSubtle}
              onPress={guardPress(() => onInsertText('##### '))}
              accessibilityLabel={t('diary.toolbar_insert_h5', '插入五级标题')}
            >
              <Text style={[styles.labelText, { color: colors.textSecondary }]}>H5</Text>
            </ToolbarButton>
          )
        case 'h6':
          return (
            <ToolbarButton
              key={id}
              borderColor={colors.borderSubtle}
              onPress={guardPress(() => onInsertText('###### '))}
              accessibilityLabel={t('diary.toolbar_insert_h6', '插入六级标题')}
            >
              <Text style={[styles.labelText, { color: colors.textSecondary }]}>H6</Text>
            </ToolbarButton>
          )
        case 'image':
          return (
            <ToolbarButton
              key={id}
              borderColor={colors.borderSubtle}
              onPress={guardPress(onPickImages)}
              disabled={!onPickImages || pickingImages}
              accessibilityLabel={t('diary.toolbar_insert_image', '插入图片')}
            >
              {pickingImages ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <MaterialIcons
                  name="image"
                  size={22}
                  color={onPickImages ? iconColor : disabledIcon}
                />
              )}
            </ToolbarButton>
          )
        default:
          return null
      }
    },
    [
      colors,
      disabledIcon,
      guardPress,
      iconColor,
      onInsertText,
      onPickImages,
      onRedo,
      onToggleMark,
      onUndo,
      pickingImages,
      t
    ]
  )

  const toolbarContent = useMemo(() => {
    const items = toolOrder.map((id) => renderTool(id))

    if (onToolOrderChange) {
      items.push(
        <ToolbarButton
          key="settings"
          borderColor={colors.borderSubtle}
          onPress={guardPress(() => setSettingsVisible(true))}
          accessibilityLabel={t('diary.toolbar_settings', '工具栏设置')}
        >
          <MaterialIcons name="tune" size={22} color={iconColor} />
        </ToolbarButton>
      )
    }

    return items
  }, [colors.borderSubtle, guardPress, iconColor, onToolOrderChange, renderTool, t, toolOrder])

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderTopColor: colors.borderSubtle
        }
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
        directionalLockEnabled
        contentContainerStyle={styles.scrollContent}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={scheduleScrollEnd}
      >
        {toolbarContent}
      </ScrollView>

      {onToolOrderChange ? (
        <MarkdownToolbarSettingsSheet
          visible={settingsVisible}
          toolOrder={toolOrder}
          onClose={() => setSettingsVisible(false)}
          onSave={onToolOrderChange}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8
  },
  btn: {
    minWidth: 44,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10
  },
  btnDisabled: {
    opacity: 0.45
  },
  hashText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24
  },
  labelText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3
  },
  markText: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22
  },
  italicText: {
    fontStyle: 'italic'
  },
  strikeText: {
    textDecorationLine: 'line-through'
  }
})
