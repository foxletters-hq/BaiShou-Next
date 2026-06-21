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

function readKeyboardHeightFromMetrics(): number {
  const metrics = Keyboard.metrics()
  return metrics?.height ?? 0
}

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

  const applyComposerLift = useCallback(
    (rawHeight: number) => {
      composerBottom.value = Math.max(0, rawHeight - tabBarHeight)
    },
    [composerBottom]
  )

  const clearComposerLift = useCallback(() => {
    composerBottom.value = 0
  }, [composerBottom])

  const resetKeyboardInset = useCallback(() => {
    clearComposerLift()
    syncKeyboardInset(0)
  }, [clearComposerLift, syncKeyboardInset])

  useEffect(() => {
    const liftOn = enableComposerKeyboardLift && !isBubbleEditing
    liftEnabled.value = liftOn ? 1 : 0

    if (!liftOn) {
      clearComposerLift()
    }

    const rawHeight = readKeyboardHeightFromMetrics()
    syncKeyboardInset(rawHeight)
    if (liftOn && rawHeight > 0) {
      applyComposerLift(rawHeight)
    }
  }, [
    enableComposerKeyboardLift,
    isBubbleEditing,
    liftEnabled,
    clearComposerLift,
    applyComposerLift,
    syncKeyboardInset
  ])

  useAnimatedReaction(
    () => ({ height: keyboard.height.value, lift: liftEnabled.value }),
    ({ height, lift }, prev) => {
      const prevHeight = prev?.height ?? 0
      if (Math.abs(height - prevHeight) >= 1) {
        runOnJS(syncKeyboardInset)(height)
      }

      if (lift === 1) {
        composerBottom.value = Math.max(0, height - tabBarHeight)
      } else if (composerBottom.value !== 0) {
        composerBottom.value = 0
      }
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
    const rawHeight = readKeyboardHeightFromMetrics()
    if (rawHeight > 0) {
      syncKeyboardInset(rawHeight)
      applyComposerLift(rawHeight)
    }
  }, [enableComposerKeyboardLift, isBubbleEditing, syncKeyboardInset, applyComposerLift])

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
