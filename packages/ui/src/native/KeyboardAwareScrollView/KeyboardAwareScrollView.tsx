import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Ref
} from 'react'
import {
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import { useKeyboardHeight } from '../hooks/useKeyboardHeight'
import { KeyboardAwareScrollContext } from './keyboard-aware-scroll.context'
import { scrollFocusedInputIntoView } from './scroll-focused-input.util'

export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  /** 键盘上方额外留白，默认 24 */
  extraKeyboardPadding?: number
  /** 键盘弹出时自动将聚焦输入框滚入可见区域，默认 true */
  autoScrollToFocusedInput?: boolean
}

function mergeKeyboardPadding(
  contentContainerStyle: StyleProp<ViewStyle> | undefined,
  keyboardPadding: number
): StyleProp<ViewStyle> {
  if (keyboardPadding <= 0) return contentContainerStyle

  const flat = StyleSheet.flatten(contentContainerStyle) ?? {}
  const basePadding =
    typeof flat.paddingBottom === 'number' ? flat.paddingBottom : 0

  return [contentContainerStyle, { paddingBottom: basePadding + keyboardPadding }]
}

export const KeyboardAwareScrollView = forwardRef(function KeyboardAwareScrollView(
  {
    contentContainerStyle,
    keyboardShouldPersistTaps = 'always',
    keyboardDismissMode = 'interactive',
    extraKeyboardPadding = 24,
    autoScrollToFocusedInput = true,
    onScroll,
    ...rest
  }: KeyboardAwareScrollViewProps,
  ref: Ref<ScrollView>
) {
  const scrollRef = useRef<ScrollView>(null)
  const scrollYRef = useRef(0)
  const prevKeyboardHeightRef = useRef(0)
  const { keyboardHeight } = useKeyboardHeight()

  const setScrollRef = useCallback(
    (node: ScrollView | null) => {
      scrollRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  useEffect(() => {
    const wasOpen = prevKeyboardHeightRef.current > 0
    prevKeyboardHeightRef.current = keyboardHeight

    if (!autoScrollToFocusedInput || keyboardHeight <= 0) return
    // 仅在键盘由关→开时滚一次，避免 iOS 动画期间多次 scrollTo 引发布局抖动
    if (wasOpen) return

    const frame = requestAnimationFrame(() => {
      scrollFocusedInputIntoView(
        scrollRef,
        scrollYRef,
        keyboardHeight,
        extraKeyboardPadding
      )
    })

    return () => cancelAnimationFrame(frame)
  }, [autoScrollToFocusedInput, extraKeyboardPadding, keyboardHeight])

  const keyboardPadding =
    keyboardHeight > 0 ? keyboardHeight + extraKeyboardPadding : 0

  const mergedContentContainerStyle = useMemo(
    () => mergeKeyboardPadding(contentContainerStyle, keyboardPadding),
    [contentContainerStyle, keyboardPadding]
  )

  const handleScroll = useCallback<NonNullable<ScrollViewProps['onScroll']>>(
    (event) => {
      scrollYRef.current = event.nativeEvent.contentOffset.y
      onScroll?.(event)
    },
    [onScroll]
  )

  const scrollFocusedIntoView = useCallback(() => {
    if (!autoScrollToFocusedInput) return
    scrollFocusedInputIntoView(
      scrollRef,
      scrollYRef,
      keyboardHeight,
      extraKeyboardPadding
    )
  }, [autoScrollToFocusedInput, extraKeyboardPadding, keyboardHeight])

  const contextValue = useMemo(
    () => ({ scrollFocusedIntoView }),
    [scrollFocusedIntoView]
  )

  return (
    <KeyboardAwareScrollContext.Provider value={contextValue}>
      <ScrollView
        ref={setScrollRef}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={mergedContentContainerStyle}
        {...rest}
      />
    </KeyboardAwareScrollContext.Provider>
  )
})
