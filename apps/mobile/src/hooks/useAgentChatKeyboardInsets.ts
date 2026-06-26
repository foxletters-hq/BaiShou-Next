import { useCallback, useEffect, useState } from 'react'
import { AppState, Keyboard, Platform, type KeyboardEvent } from 'react-native'
import {
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated'

/** 编辑态：保存按钮与 token 行距键盘顶部的留白 */
const BUBBLE_EDIT_KEYBOARD_BUFFER = 72
/** 编辑态且键盘收起时：保存/token 与底部工具栏之间的额外间距 */
const BUBBLE_EDIT_DOCK_GAP = 16
/** 流式输出时列表底部额外留白：把最新气泡抬高到输入栏上方，留出可读空间 */
const STREAMING_LIST_BOTTOM_BUFFER = 56
const COMPOSER_LIST_GAP = 24

function readKeyboardHeightFromMetrics(): number {
  const metrics = Keyboard.metrics()
  return metrics?.height ?? 0
}

function computeComposerInset(rawHeight: number, tabBarHeight: number): number {
  return Math.max(0, Math.ceil(rawHeight) - tabBarHeight)
}

export function useAgentChatKeyboardInsets({
  tabBarHeight,
  inputDockHeight,
  isBubbleEditing,
  enableComposerKeyboardLift = true,
  streamingActive = false
}: {
  tabBarHeight: number
  inputDockHeight: number
  isBubbleEditing: boolean
  /** 为 false 时主输入栏不随键盘上移（侧边栏/弹层打开时） */
  enableComposerKeyboardLift?: boolean
  /** 流式输出中：加大列表底部 padding，防止 StreamingBubble 与输入栏重叠 */
  streamingActive?: boolean
}) {
  const keyboard = useAnimatedKeyboard()
  /** 仅用于气泡编辑滚动定位；不在键盘动画每帧更新，避免 FlatList 卡顿 */
  const [keyboardInset, setKeyboardInset] = useState(0)
  const liftEnabled = useSharedValue(enableComposerKeyboardLift && !isBubbleEditing ? 1 : 0)
  const isBubbleEditingSv = useSharedValue(isBubbleEditing ? 1 : 0)
  const inputDockHeightSv = useSharedValue(inputDockHeight)
  const streamingBufferSv = useSharedValue(
    streamingActive && !isBubbleEditing ? STREAMING_LIST_BOTTOM_BUFFER : 0
  )
  const composerBottom = useSharedValue(0)
  const listSpacerHeight = useSharedValue(inputDockHeight + COMPOSER_LIST_GAP)

  const syncKeyboardInset = useCallback(
    (rawHeight: number) => {
      const next = computeComposerInset(rawHeight, tabBarHeight)
      setKeyboardInset((prev) => (prev === next ? prev : next))
    },
    [tabBarHeight]
  )

  const applyComposerLift = useCallback(
    (rawHeight: number) => {
      composerBottom.value = computeComposerInset(rawHeight, tabBarHeight)
    },
    [composerBottom, tabBarHeight]
  )

  const clearComposerLift = useCallback(() => {
    composerBottom.value = 0
  }, [composerBottom])

  const resetKeyboardInset = useCallback(() => {
    clearComposerLift()
    syncKeyboardInset(0)
  }, [clearComposerLift, syncKeyboardInset])

  useEffect(() => {
    inputDockHeightSv.value = inputDockHeight
  }, [inputDockHeight, inputDockHeightSv])

  useEffect(() => {
    streamingBufferSv.value =
      streamingActive && !isBubbleEditing ? STREAMING_LIST_BOTTOM_BUFFER : 0
  }, [streamingActive, isBubbleEditing, streamingBufferSv])

  useEffect(() => {
    const liftOn = enableComposerKeyboardLift && !isBubbleEditing
    liftEnabled.value = liftOn ? 1 : 0
    isBubbleEditingSv.value = isBubbleEditing ? 1 : 0

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
    isBubbleEditingSv,
    clearComposerLift,
    applyComposerLift,
    syncKeyboardInset
  ])

  useAnimatedReaction(
    () => ({
      height: keyboard.height.value,
      lift: liftEnabled.value,
      editing: isBubbleEditingSv.value,
      dockH: inputDockHeightSv.value,
      streamBuf: streamingBufferSv.value
    }),
    ({ height, lift, editing, dockH, streamBuf }) => {
      const inset = Math.max(0, Math.ceil(height) - tabBarHeight)

      if (lift === 1) {
        composerBottom.value = inset
      } else if (composerBottom.value !== 0) {
        composerBottom.value = 0
      }

      if (editing === 1) {
        const editKeyboardVisible = inset >= 60
        listSpacerHeight.value = editKeyboardVisible
          ? inset + BUBBLE_EDIT_KEYBOARD_BUFFER + 16
          : dockH + BUBBLE_EDIT_KEYBOARD_BUFFER + BUBBLE_EDIT_DOCK_GAP
        return
      }

      const composerInset = lift === 1 ? inset : 0
      listSpacerHeight.value = dockH + composerInset + COMPOSER_LIST_GAP + streamBuf
    },
    [tabBarHeight]
  )

  // 键盘显隐时同步编辑态 inset（非逐帧），供气泡编辑滚动使用
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const onShow = (event: KeyboardEvent) => {
      syncKeyboardInset(event.endCoordinates.height)
    }
    const onHide = () => {
      syncKeyboardInset(0)
    }

    const showSub = Keyboard.addListener(showEvent, onShow)
    const hideSub = Keyboard.addListener(hideEvent, onHide)

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [syncKeyboardInset])

  // 切到其他 App 时系统会收起键盘，但 useAnimatedKeyboard 可能不更新，需主动复位
  useEffect(() => {
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const hideSub = Keyboard.addListener(hideEvent, resetKeyboardInset)

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        resetKeyboardInset()
        return
      }

      if (nextState !== 'active') return

      const rawHeight = readKeyboardHeightFromMetrics()
      if (rawHeight <= 0) {
        resetKeyboardInset()
        return
      }

      syncKeyboardInset(rawHeight)
      if (enableComposerKeyboardLift && !isBubbleEditing) {
        applyComposerLift(rawHeight)
      }
    })

    return () => {
      hideSub.remove()
      appStateSub.remove()
    }
  }, [
    resetKeyboardInset,
    syncKeyboardInset,
    applyComposerLift,
    enableComposerKeyboardLift,
    isBubbleEditing
  ])

  const inputDockAnimatedStyle = useAnimatedStyle(() => ({
    bottom: composerBottom.value
  }))

  const scrollButtonAnimatedStyle = useAnimatedStyle(() => ({
    bottom: composerBottom.value + inputDockHeightSv.value + 12
  }))

  const listSpacerAnimatedStyle = useAnimatedStyle(() => ({
    height: listSpacerHeight.value
  }))

  const handleComposerFocus = useCallback(() => {
    if (!enableComposerKeyboardLift || isBubbleEditing) return
    const rawHeight = readKeyboardHeightFromMetrics()
    if (rawHeight > 0) {
      applyComposerLift(rawHeight)
    }
  }, [enableComposerKeyboardLift, isBubbleEditing, applyComposerLift])

  const isEditKeyboardVisible = keyboardInset >= 60
  const listBottomPadding = isBubbleEditing
    ? isEditKeyboardVisible
      ? keyboardInset + BUBBLE_EDIT_KEYBOARD_BUFFER + 16
      : inputDockHeight + BUBBLE_EDIT_KEYBOARD_BUFFER + BUBBLE_EDIT_DOCK_GAP
    : inputDockHeight + keyboardInset + COMPOSER_LIST_GAP +
      (streamingActive ? STREAMING_LIST_BOTTOM_BUFFER : 0)

  return {
    keyboardInset,
    inputDockAnimatedStyle,
    scrollButtonAnimatedStyle,
    listSpacerAnimatedStyle,
    listBottomPadding,
    handleComposerFocus,
    resetKeyboardInset
  }
}
