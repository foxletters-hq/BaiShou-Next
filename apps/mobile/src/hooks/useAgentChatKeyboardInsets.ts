import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Keyboard, Platform, type KeyboardEvent } from 'react-native'
import { sharedTokens } from '@baishou/ui/theme/tokens'
import {
  cancelAnimation,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing
} from 'react-native-reanimated'

/** 编辑态：保存按钮与 token 行距键盘顶部的留白 */
const BUBBLE_EDIT_KEYBOARD_BUFFER = 72
/** 编辑态且键盘收起时：保存/token 与底部工具栏之间的额外间距 */
const BUBBLE_EDIT_DOCK_GAP = 16
/** 列表底部与输入栏之间的留白（由 footer spacer 承担，勿与 listContent.paddingBottom 重复） */
const COMPOSER_LIST_GAP = sharedTokens.spacing.smPlus
/** 回到底部按钮与输入栏顶部的间距 */
const SCROLL_BUTTON_DOCK_GAP = sharedTokens.spacing.smPlus

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
  listViewportHeight = 0,
  canLiftListContent = false,
  onKeyboardShow
}: {
  tabBarHeight: number
  inputDockHeight: number
  isBubbleEditing: boolean
  /** 为 false 时主输入栏不随键盘上移（侧边栏/弹层打开时） */
  enableComposerKeyboardLift?: boolean
  /** 列表可视区域高度，用于在 UI 线程计算消息随键盘上推量 */
  listViewportHeight?: number
  /** 列表是否有非空消息/流式内容需要随键盘上推 */
  canLiftListContent?: boolean
  /** 键盘展开且输入栏上抬时触发，用于同步将对话列表推到底部 */
  onKeyboardShow?: () => void
}) {
  const onKeyboardShowRef = useRef(onKeyboardShow)
  onKeyboardShowRef.current = onKeyboardShow
  const keyboard = useAnimatedKeyboard()
  /** 仅用于气泡编辑滚动定位；不在键盘动画每帧更新，避免 FlatList 卡顿 */
  const [keyboardInset, setKeyboardInset] = useState(0)
  const latestRawKeyboardHeightRef = useRef(0)
  const liftEnabled = useSharedValue(enableComposerKeyboardLift && !isBubbleEditing ? 1 : 0)
  /** 仅键盘真实显示时为 1；避免侧边栏关闭后 useAnimatedKeyboard 残留高度误抬输入栏 */
  const keyboardVisibleSv = useSharedValue(0)
  /** 键盘动画运动方向：1 升起、-1 收起、0 静止（规避 Android Reanimated mHeight>0 时将 OPENING 误标为 CLOSING） */
  const keyboardMotionSv = useSharedValue(0)
  /** 记录本轮键盘展开峰值高度，识别 Android 收起动画末帧丢帧导致的半截卡滞 */
  const peakKeyboardHeightSv = useSharedValue(0)
  /** 记录 JS Keyboard 事件上报的兜底高度，与 useAnimatedReaction 统一驱动 composerBottom */
  const fallbackKeyboardHeightSv = useSharedValue(0)
  /** 主动收起键盘后的短暂抑制窗口，拦截发送/失焦瞬间滞后到达的 keyboardDidShow */
  const suppressShowUntilRef = useRef(0)
  const isBubbleEditingSv = useSharedValue(isBubbleEditing ? 1 : 0)
  const inputDockHeightSv = useSharedValue(inputDockHeight)
  const listViewportHeightSv = useSharedValue(listViewportHeight)
  const listContentHeightSv = useSharedValue(0)
  const canLiftListContentSv = useSharedValue(canLiftListContent ? 1 : 0)
  const composerBottom = useSharedValue(0)
  const listSpacerHeight = useSharedValue(inputDockHeight + COMPOSER_LIST_GAP)

  const syncKeyboardInset = useCallback(
    (rawHeight: number) => {
      latestRawKeyboardHeightRef.current = rawHeight
      if (isBubbleEditingSv.value !== 1) return
      const next = computeComposerInset(rawHeight, tabBarHeight)
      setKeyboardInset((prev) => (prev === next ? prev : next))
    },
    [tabBarHeight, isBubbleEditingSv]
  )

  const syncListContentHeight = useCallback(
    (height: number) => {
      if (height > 0) {
        listContentHeightSv.value = height
      }
    },
    [listContentHeightSv]
  )

  const applyListSpacerForBubbleEdit = useCallback(
    (rawHeight: number, durationMs = 250) => {
      const inset = computeComposerInset(rawHeight, tabBarHeight)
      const target = inset + BUBBLE_EDIT_KEYBOARD_BUFFER + 16
      cancelAnimation(listSpacerHeight)
      listSpacerHeight.value =
        durationMs > 0
          ? withTiming(target, { duration: durationMs, easing: Easing.out(Easing.cubic) })
          : target
    },
    [listSpacerHeight, tabBarHeight]
  )

  const resetListSpacerForBubbleEdit = useCallback(
    (durationMs = 250) => {
      const target = inputDockHeightSv.value + BUBBLE_EDIT_KEYBOARD_BUFFER + BUBBLE_EDIT_DOCK_GAP
      cancelAnimation(listSpacerHeight)
      listSpacerHeight.value =
        durationMs > 0
          ? withTiming(target, { duration: durationMs, easing: Easing.out(Easing.cubic) })
          : target
    },
    [listSpacerHeight, inputDockHeightSv]
  )

  const applyComposerLift = useCallback(
    (rawHeight: number) => {
      fallbackKeyboardHeightSv.value = rawHeight
      cancelAnimation(composerBottom)
      composerBottom.value = computeComposerInset(rawHeight, tabBarHeight)
    },
    [composerBottom, fallbackKeyboardHeightSv, tabBarHeight]
  )

  const clearComposerLift = useCallback(() => {
    fallbackKeyboardHeightSv.value = 0
    cancelAnimation(composerBottom)
    composerBottom.value = 0
  }, [composerBottom, fallbackKeyboardHeightSv])

  const handleNativeKeyboardClosed = useCallback(() => {
    syncKeyboardInset(0)
  }, [syncKeyboardInset])

  const resetKeyboardInset = useCallback(() => {
    suppressShowUntilRef.current = Date.now() + 350
    keyboardVisibleSv.value = 0
    keyboardMotionSv.value = 0
    peakKeyboardHeightSv.value = 0
    clearComposerLift()
    syncKeyboardInset(0)
  }, [
    clearComposerLift,
    syncKeyboardInset,
    keyboardVisibleSv,
    keyboardMotionSv,
    peakKeyboardHeightSv
  ])

  useEffect(() => {
    inputDockHeightSv.value = inputDockHeight
    listViewportHeightSv.value = listViewportHeight
    canLiftListContentSv.value = canLiftListContent ? 1 : 0
  }, [
    inputDockHeight,
    listViewportHeight,
    canLiftListContent,
    inputDockHeightSv,
    listViewportHeightSv,
    canLiftListContentSv
  ])

  useEffect(() => {
    const liftOn = enableComposerKeyboardLift && !isBubbleEditing
    liftEnabled.value = liftOn ? 1 : 0
    isBubbleEditingSv.value = isBubbleEditing ? 1 : 0

    if (isBubbleEditing) {
      const next = computeComposerInset(latestRawKeyboardHeightRef.current, tabBarHeight)
      setKeyboardInset((prev) => (prev === next ? prev : next))
    }

    if (!liftOn) {
      keyboardVisibleSv.value = 0
      keyboardMotionSv.value = 0
      peakKeyboardHeightSv.value = 0
      clearComposerLift()
      syncKeyboardInset(0)
      return
    }

    const nativeOpen =
      keyboard.height.value > 0 && (keyboard.state.value === 1 || keyboard.state.value === 2)
    const keyboardVisible =
      Date.now() >= suppressShowUntilRef.current &&
      Keyboard.isVisible?.() === true &&
      (Platform.OS === 'ios' || nativeOpen)
    const rawHeight = keyboardVisible ? readKeyboardHeightFromMetrics() : 0
    if (keyboardVisible && rawHeight > 0) {
      fallbackKeyboardHeightSv.value = rawHeight
      peakKeyboardHeightSv.value = rawHeight
      keyboardVisibleSv.value = 1
      syncKeyboardInset(rawHeight)
      applyComposerLift(rawHeight)
    } else {
      keyboardVisibleSv.value = 0
      keyboardMotionSv.value = 0
      peakKeyboardHeightSv.value = 0
      syncKeyboardInset(0)
      clearComposerLift()
    }
  }, [
    enableComposerKeyboardLift,
    isBubbleEditing,
    tabBarHeight,
    liftEnabled,
    keyboard.height,
    keyboard.state,
    keyboardVisibleSv,
    keyboardMotionSv,
    peakKeyboardHeightSv,
    fallbackKeyboardHeightSv,
    isBubbleEditingSv,
    clearComposerLift,
    applyComposerLift,
    syncKeyboardInset
  ])

  useAnimatedReaction(
    () => ({
      height: keyboard.height.value,
      state: keyboard.state.value,
      lift: liftEnabled.value,
      kbVisible: keyboardVisibleSv.value,
      fallbackHeight: fallbackKeyboardHeightSv.value,
      bottom: composerBottom.value
    }),
    ({ height, state, lift, kbVisible, fallbackHeight, bottom }, prev) => {
      let nextKbVisible = kbVisible
      const isAnimatingState = state === 1 || state === 3
      const isHeightRising =
        height > 0 &&
        (prev == null ||
          height > prev.height ||
          (state === 1 && prev.state !== 1 && prev.height <= 0))
      const isHeightFalling = prev != null && height < prev.height

      if (isHeightRising && (isAnimatingState || (prev != null && prev.height <= 0))) {
        keyboardMotionSv.value = 1
        if (lift === 1 && nextKbVisible === 0) {
          nextKbVisible = 1
          keyboardVisibleSv.value = 1
        }
      } else if (nextKbVisible === 1 && isHeightFalling) {
        keyboardMotionSv.value = -1
      }

      if (nextKbVisible === 1 && height > peakKeyboardHeightSv.value) {
        peakKeyboardHeightSv.value = height
      }

      const peak = peakKeyboardHeightSv.value
      const droppedFromPeak =
        peak > 0 && height > 0 && height <= peak - 40 && (prev == null || height <= prev.height)
      const animationEnded = state === 2 || state === 4
      const closingFinished =
        prev != null &&
        (prev.state === 3 || prev.state === 1) &&
        animationEnded &&
        (keyboardMotionSv.value === -1 || state === 4 || height <= 0)
      const transitionedToClosed = prev != null && prev.state !== 4 && state === 4
      const heightDroppedToZero = prev != null && prev.height > 0 && height <= 0
      const nativeClosed =
        transitionedToClosed ||
        heightDroppedToZero ||
        closingFinished ||
        (nextKbVisible === 1 && keyboardMotionSv.value === -1 && droppedFromPeak && animationEnded)

      if (nativeClosed) {
        keyboardVisibleSv.value = 0
        keyboardMotionSv.value = 0
        peakKeyboardHeightSv.value = 0
        fallbackKeyboardHeightSv.value = 0
        if (composerBottom.value !== 0) {
          composerBottom.value = 0
        }
        runOnJS(handleNativeKeyboardClosed)()
        return
      }

      if (animationEnded && keyboardMotionSv.value !== 0) {
        keyboardMotionSv.value = 0
      }

      const effectiveHeight =
        height > 0 ? height : keyboardMotionSv.value !== -1 ? fallbackHeight : 0
      const inset = Math.max(0, Math.ceil(effectiveHeight) - tabBarHeight)
      const shouldLift = lift === 1 && nextKbVisible === 1

      if (shouldLift) {
        if (bottom !== inset) {
          composerBottom.value = inset
        }
      } else if (bottom !== 0) {
        composerBottom.value = 0
      }
    },
    [tabBarHeight, handleNativeKeyboardClosed]
  )

  useEffect(() => {
    if (!isBubbleEditing) return
    cancelAnimation(listSpacerHeight)
    listSpacerHeight.value = withTiming(
      inputDockHeight + BUBBLE_EDIT_KEYBOARD_BUFFER + BUBBLE_EDIT_DOCK_GAP,
      { duration: sharedTokens.animation.swift, easing: Easing.out(Easing.cubic) }
    )
  }, [isBubbleEditing, inputDockHeight, listSpacerHeight])

  // 键盘显隐时同步编辑态 inset（非逐帧），供气泡编辑滚动使用
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const onShow = (event: KeyboardEvent) => {
      const height = event.endCoordinates.height
      if (height <= 0) return
      if (Date.now() < suppressShowUntilRef.current) return
      if (
        Platform.OS === 'android' &&
        (keyboardMotionSv.value === -1 || Keyboard.isVisible?.() === false)
      ) {
        return
      }
      fallbackKeyboardHeightSv.value = height
      peakKeyboardHeightSv.value = Math.max(
        peakKeyboardHeightSv.value,
        height,
        keyboard.height.value
      )
      keyboardVisibleSv.value = 1
      const duration = event.duration ?? 250
      syncKeyboardInset(height)
      if (enableComposerKeyboardLift && !isBubbleEditing) {
        applyComposerLift(height)
        onKeyboardShowRef.current?.()
      } else if (isBubbleEditing) {
        applyListSpacerForBubbleEdit(height, duration)
      }
    }
    const onHide = (event?: KeyboardEvent) => {
      keyboardVisibleSv.value = 0
      keyboardMotionSv.value = 0
      peakKeyboardHeightSv.value = 0
      clearComposerLift()
      syncKeyboardInset(0)
      if (isBubbleEditing) {
        const duration = event?.duration ?? 250
        resetListSpacerForBubbleEdit(duration)
      }
    }

    const showSub = Keyboard.addListener(showEvent, onShow)
    const hideSub = Keyboard.addListener(hideEvent, onHide)

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [
    syncKeyboardInset,
    keyboard.height,
    keyboardVisibleSv,
    keyboardMotionSv,
    peakKeyboardHeightSv,
    fallbackKeyboardHeightSv,
    enableComposerKeyboardLift,
    isBubbleEditing,
    applyComposerLift,
    applyListSpacerForBubbleEdit,
    resetListSpacerForBubbleEdit,
    clearComposerLift
  ])

  // 切到其他 App 时系统会收起键盘，但 useAnimatedKeyboard 可能不更新，需主动复位
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        resetKeyboardInset()
        return
      }

      if (nextState !== 'active') return

      const nativeOpen =
        keyboard.height.value > 0 && (keyboard.state.value === 1 || keyboard.state.value === 2)
      const keyboardVisible = Keyboard.isVisible?.() === true && nativeOpen
      if (!keyboardVisible) {
        resetKeyboardInset()
        return
      }
      const rawHeight = readKeyboardHeightFromMetrics() || keyboard.height.value
      if (rawHeight <= 0) {
        resetKeyboardInset()
        return
      }
      fallbackKeyboardHeightSv.value = rawHeight
      if (keyboard.height.value > peakKeyboardHeightSv.value) {
        peakKeyboardHeightSv.value = keyboard.height.value
      }
      keyboardVisibleSv.value = 1

      syncKeyboardInset(rawHeight)
      if (enableComposerKeyboardLift && !isBubbleEditing) {
        applyComposerLift(rawHeight)
      }
    })

    return () => {
      appStateSub.remove()
    }
  }, [
    resetKeyboardInset,
    syncKeyboardInset,
    applyComposerLift,
    enableComposerKeyboardLift,
    isBubbleEditing,
    keyboard.height,
    keyboard.state,
    keyboardVisibleSv,
    peakKeyboardHeightSv,
    fallbackKeyboardHeightSv
  ])

  const inputDockAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -composerBottom.value }]
  }))

  const scrollButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -(composerBottom.value + inputDockHeightSv.value + SCROLL_BUTTON_DOCK_GAP) }
    ]
  }))

  const listSpacerAnimatedStyle = useAnimatedStyle(() => {
    if (isBubbleEditingSv.value === 1) {
      return { height: listSpacerHeight.value }
    }
    return { height: inputDockHeightSv.value + COMPOSER_LIST_GAP }
  })

  const listKeyboardAnimatedStyle = useAnimatedStyle(() => {
    if (
      isBubbleEditingSv.value === 1 ||
      canLiftListContentSv.value === 0 ||
      composerBottom.value <= 0
    ) {
      return { transform: [{ translateY: 0 }] }
    }
    const vh = listViewportHeightSv.value
    const ch = listContentHeightSv.value
    if (vh <= 0 || ch <= 0) {
      return { transform: [{ translateY: -composerBottom.value }] }
    }
    const gapAboveDock = Math.max(0, vh - ch)
    const liftOffset = Math.max(0, composerBottom.value - gapAboveDock)
    return { transform: [{ translateY: -liftOffset }] }
  })

  const handleComposerFocus = useCallback(() => {
    suppressShowUntilRef.current = 0
    if (!enableComposerKeyboardLift || isBubbleEditing) return
    if (Keyboard.isVisible?.() !== true) return
    const rawHeight = readKeyboardHeightFromMetrics() || keyboard.height.value
    if (rawHeight > 0) {
      fallbackKeyboardHeightSv.value = rawHeight
      if (keyboard.height.value > peakKeyboardHeightSv.value) {
        peakKeyboardHeightSv.value = keyboard.height.value
      }
      keyboardVisibleSv.value = 1
      applyComposerLift(rawHeight)
      onKeyboardShowRef.current?.()
    }
  }, [
    enableComposerKeyboardLift,
    isBubbleEditing,
    applyComposerLift,
    keyboard.height,
    keyboardVisibleSv,
    peakKeyboardHeightSv,
    fallbackKeyboardHeightSv
  ])

  useEffect(() => {
    return () => {
      cancelAnimation(listSpacerHeight)
      cancelAnimation(composerBottom)
    }
  }, [listSpacerHeight, composerBottom])

  return {
    keyboardInset,
    inputDockAnimatedStyle,
    scrollButtonAnimatedStyle,
    listSpacerAnimatedStyle,
    listKeyboardAnimatedStyle,
    syncListContentHeight,
    handleComposerFocus,
    resetKeyboardInset
  }
}
