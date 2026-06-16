import { useCallback, useEffect, useState } from 'react'
import { Keyboard } from 'react-native'
import {
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  runOnJS
} from 'react-native-reanimated'

/** 编辑态：保存按钮与 token 行距键盘顶部的留白 */
const BUBBLE_EDIT_KEYBOARD_BUFFER = 72
/** 编辑态且键盘收起时：保存/token 与底部工具栏之间的额外间距 */
const BUBBLE_EDIT_DOCK_GAP = 16

export function useAgentChatKeyboardInsets({
  tabBarHeight,
  inputDockHeight,
  isBubbleEditing,
  enableComposerKeyboardLift = true
}: {
  tabBarHeight: number
  inputDockHeight: number
  isBubbleEditing: boolean
  /** 为 false 时主输入栏不随键盘上移（侧边栏/弹层打开时） */
  enableComposerKeyboardLift?: boolean
}) {
  const keyboard = useAnimatedKeyboard()
  const [keyboardInset, setKeyboardInset] = useState(0)
  const liftEnabled = useSharedValue(enableComposerKeyboardLift && !isBubbleEditing ? 1 : 0)
  const composerBottom = useSharedValue(0)

  const syncKeyboardInset = useCallback(
    (rawHeight: number) => {
      const next = Math.max(0, Math.ceil(rawHeight) - tabBarHeight)
      setKeyboardInset((prev) => (prev === next ? prev : next))
    },
    [tabBarHeight]
  )

  const applyComposerBottom = useCallback(
    (rawHeight: number) => {
      composerBottom.value = Math.max(0, rawHeight - tabBarHeight)
      syncKeyboardInset(rawHeight)
    },
    [composerBottom, syncKeyboardInset, tabBarHeight]
  )

  const clearComposerBottom = useCallback(() => {
    composerBottom.value = 0
    syncKeyboardInset(0)
  }, [composerBottom, syncKeyboardInset])

  useEffect(() => {
    const enabled = enableComposerKeyboardLift && !isBubbleEditing
    liftEnabled.value = enabled ? 1 : 0
    if (!enabled) {
      clearComposerBottom()
      return
    }
    const metrics = Keyboard.metrics()
    applyComposerBottom(metrics?.height ?? 0)
  }, [
    enableComposerKeyboardLift,
    isBubbleEditing,
    liftEnabled,
    clearComposerBottom,
    applyComposerBottom
  ])

  useAnimatedReaction(
    () => ({ height: keyboard.height.value, enabled: liftEnabled.value }),
    ({ height, enabled }, prev) => {
      if (!enabled) {
        if (composerBottom.value !== 0) composerBottom.value = 0
        return
      }
      const prevHeight = prev?.height ?? 0
      if (Math.abs(height - prevHeight) < 1) return
      composerBottom.value = Math.max(0, height - tabBarHeight)
      runOnJS(syncKeyboardInset)(height)
    },
    [syncKeyboardInset, tabBarHeight]
  )

  const inputDockAnimatedStyle = useAnimatedStyle(() => ({
    bottom: composerBottom.value
  }))

  const scrollButtonAnimatedStyle = useAnimatedStyle(
    () => ({
      bottom: composerBottom.value + inputDockHeight + 12
    }),
    [inputDockHeight]
  )

  const handleComposerFocus = useCallback(() => {
    if (!enableComposerKeyboardLift || isBubbleEditing) return
    const metrics = Keyboard.metrics()
    if (metrics?.height) {
      applyComposerBottom(metrics.height)
    }
  }, [enableComposerKeyboardLift, isBubbleEditing, applyComposerBottom])

  const resetKeyboardInset = useCallback(() => {
    clearComposerBottom()
  }, [clearComposerBottom])

  const composerInset = enableComposerKeyboardLift ? keyboardInset : 0
  const isEditKeyboardVisible = keyboardInset >= 60
  const listBottomPadding = isBubbleEditing
    ? isEditKeyboardVisible
      ? keyboardInset + BUBBLE_EDIT_KEYBOARD_BUFFER + 16
      : inputDockHeight + BUBBLE_EDIT_KEYBOARD_BUFFER + BUBBLE_EDIT_DOCK_GAP
    : inputDockHeight + composerInset + 24

  return {
    keyboardInset,
    inputDockAnimatedStyle,
    scrollButtonAnimatedStyle,
    listBottomPadding,
    handleComposerFocus,
    resetKeyboardInset
  }
}
