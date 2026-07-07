import i18n from 'i18next'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { useNativeTheme } from '../theme'
import type { DiaryCmTableSheetSectionPayload } from '../../shared/diary-codemirror/types'

export interface TableChromeBottomSheetProps {
  visible: boolean
  title: string
  sections: DiaryCmTableSheetSectionPayload[]
  /** 距屏幕底部的偏移（仅键盘高度；表格菜单盖住 Markdown 工具栏） */
  bottomOffset: number
  onPick: (itemId: string) => void
  onDismiss: () => void
  style?: StyleProp<ViewStyle>
}

/** 与 WebView 内 .cm-table-sheet transition 0.34s cubic-bezier(0.32, 0.72, 0, 1) 对齐 */
const SLIDE_MS = 340
const SHEET_OFFSCREEN_Y = 420
const SHEET_EASING = Easing.bezier(0.32, 0.72, 0, 1)

export const TableChromeBottomSheet: React.FC<TableChromeBottomSheetProps> = ({
  visible,
  title,
  sections,
  bottomOffset,
  onPick,
  onDismiss,
  style
}) => {
  const { colors } = useNativeTheme()
  const [mounted, setMounted] = useState(false)
  const translateY = useSharedValue(SHEET_OFFSCREEN_Y)
  const backdropOpacity = useSharedValue(0)
  const closingRef = useRef(false)

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }]
  }))

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value
  }))

  const finishUnmount = useCallback(() => {
    setMounted(false)
  }, [])

  const playEnter = useCallback(() => {
    translateY.value = SHEET_OFFSCREEN_Y
    backdropOpacity.value = 0
    translateY.value = withTiming(0, { duration: SLIDE_MS, easing: SHEET_EASING })
    backdropOpacity.value = withTiming(1, { duration: SLIDE_MS, easing: SHEET_EASING })
  }, [backdropOpacity, translateY])

  const playExit = useCallback(
    (onDone: () => void) => {
      translateY.value = withTiming(
        SHEET_OFFSCREEN_Y,
        { duration: SLIDE_MS, easing: SHEET_EASING },
        (finished) => {
          if (!finished) return
          runOnJS(finishUnmount)()
          runOnJS(onDone)()
        }
      )
      backdropOpacity.value = withTiming(0, { duration: SLIDE_MS, easing: SHEET_EASING })
    },
    [backdropOpacity, finishUnmount, translateY]
  )

  useEffect(() => {
    if (!visible) return
    closingRef.current = false
    setMounted(true)
  }, [visible])

  useEffect(() => {
    if (!mounted || closingRef.current) return
    playEnter()
  }, [mounted, playEnter])

  const animateOut = useCallback(
    (done: () => void) => {
      if (closingRef.current) return
      closingRef.current = true
      playExit(done)
    },
    [playExit]
  )

  const handleDismiss = () => {
    animateOut(onDismiss)
  }

  const handlePick = (itemId: string) => {
    // 表格操作须立即回传 WebView；若等关闭动画结束，Android 上 RN→WebView 消息可能丢失且手势链已断
    onPick(itemId)
    if (!closingRef.current) {
      closingRef.current = true
      finishUnmount()
    }
  }

  if (!mounted) return null

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={handleDismiss}
    >
      <View style={[styles.root, style]}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel={i18n.t(
              'auto.packages.ui.src.native.DiaryEditor.TableChromeBottomSheet.L138',
              '关闭菜单'
            )}
          />
        </Animated.View>
        <View style={styles.sheetDock} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              sheetStyle,
              {
                marginBottom: bottomOffset,
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle
              }
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: colors.borderSubtle }]} />
            {title ? (
              <Text style={[styles.title, { color: colors.textSecondary }]} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              {sections.map((section, sectionIndex) => {
                const destructiveGroup = section.items.every((item) => item.destructive)
                return (
                  <View
                    key={`section-${sectionIndex}`}
                    style={[
                      styles.group,
                      {
                        backgroundColor: colors.bgSurfaceNormal,
                        borderColor: colors.borderSubtle
                      },
                      sectionIndex > 0 ? styles.groupSpacing : null,
                      destructiveGroup ? styles.groupDestructive : null
                    ]}
                  >
                    {section.items.map((item, itemIndex) => {
                      const isLast = itemIndex === section.items.length - 1
                      return (
                        <Pressable
                          key={item.id}
                          disabled={Boolean(item.disabled)}
                          onPress={() => handlePick(item.id)}
                          accessibilityRole="menuitem"
                          style={({ pressed }) => [
                            styles.item,
                            !isLast && {
                              borderBottomWidth: StyleSheet.hairlineWidth,
                              borderBottomColor: colors.borderSubtle
                            },
                            pressed && !item.disabled
                              ? { backgroundColor: colors.bgSurface }
                              : null,
                            item.disabled ? styles.itemDisabled : null
                          ]}
                        >
                          <Text
                            style={[
                              styles.itemLabel,
                              { color: item.destructive ? colors.error : colors.textPrimary },
                              item.disabled ? styles.itemLabelDisabled : null
                            ]}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                )
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.32)'
  },
  sheetDock: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end'
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '72%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 2
  },
  title: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.13,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12
  },
  bodyScroll: {
    flexGrow: 0
  },
  bodyContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
    gap: 8
  },
  group: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth
  },
  groupSpacing: {
    marginTop: 0
  },
  groupDestructive: {
    marginTop: 2
  },
  item: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  itemDisabled: {
    opacity: 0.45
  },
  itemLabel: {
    fontSize: 16,
    lineHeight: 21
  },
  itemLabelDisabled: {
    opacity: 0.7
  }
})
