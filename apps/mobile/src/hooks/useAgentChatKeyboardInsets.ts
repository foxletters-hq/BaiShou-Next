import { useCallback, useState } from 'react'
import { Keyboard } from 'react-native'
import {
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
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

  const syncKeyboardInset = useCallback(
    (rawHeight: number) => {
      const next = Math.max(0, Math.ceil(rawHeight) - tabBarHeight)
      setKeyboardInset((prev) => (prev === next ? prev : next))
    },
    [tabBarHeight]
  )

  useAnimatedReaction(
    () => keyboard.height.value,
    (height, prevHeight) => {
      const prev = prevHeight ?? 0
      if (Math.abs(height - prev) < 1) return
      runOnJS(syncKeyboardInset)(height)
    },
    [syncKeyboardInset]
  )

  const inputDockAnimatedStyle = useAnimatedStyle(() => {
    if (isBubbleEditing || !enableComposerKeyboardLift) return { bottom: 0 }
    return { bottom: Math.max(0, keyboard.height.value - tabBarHeight) }
  }, [isBubbleEditing, enableComposerKeyboardLift, tabBarHeight])

  const scrollButtonAnimatedStyle = useAnimatedStyle(() => {
    const dockBottom =
      isBubbleEditing || !enableComposerKeyboardLift
        ? 0
        : Math.max(0, keyboard.height.value - tabBarHeight)
    return { bottom: dockBottom + inputDockHeight + 12 }
  }, [isBubbleEditing, enableComposerKeyboardLift, tabBarHeight, inputDockHeight])

  const handleComposerFocus = useCallback(() => {
    const metrics = Keyboard.metrics()
    if (metrics?.height) {
      syncKeyboardInset(metrics.height)
    }
  }, [syncKeyboardInset])

  const resetKeyboardInset = useCallback(() => {
    syncKeyboardInset(0)
  }, [syncKeyboardInset])

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
