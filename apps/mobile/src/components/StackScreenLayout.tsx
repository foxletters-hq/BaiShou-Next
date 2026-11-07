import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { View, StatusBar, StyleSheet, type LayoutChangeEvent, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNativeTheme } from '@baishou/ui/native'
import { StackScreenHeader, type StackScreenHeaderProps } from './StackScreenHeader'
import { getStackScreenChrome } from './stackScreenChrome'
import { logNavigationPhase, sampleTransitionFrames } from '../navigation/transitionDiagnostics'

const FADE_IN_DURATION_MS = 240
void FadeIn

export interface StackScreenLayoutProps extends StackScreenHeaderProps {
  children: React.ReactNode
  backgroundColor?: string
  contentStyle?: ViewStyle
}

/**
 * 栈内全屏子页统一壳（与局域网传输页同款顶栏）。
 * 路由必须 `headerShown: false`，避免系统导航栏与自定义顶栏重复。
 *
 * 含输入框的表单页请用 `KeyboardAwareScrollView` 包裹内容（替代 `ScrollView`），
 * 以统一处理 Android adjustNothing 下的键盘留白与自动滚入聚焦输入框。
 * 页面内 `@baishou/ui/native` 的 `Input` 在聚焦时会自动向最近的
 * `KeyboardAwareScrollView` 请求滚入安全区。
 */
export const StackScreenLayout: React.FC<StackScreenLayoutProps> = ({
  children,
  backgroundColor,
  contentStyle,
  transparent: transparentProp,
  ...headerProps
}) => {
  const { colors, isDark } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const chrome = getStackScreenChrome(colors)
  const bg = backgroundColor ?? chrome.backgroundColor
  const transparent = transparentProp ?? chrome.transparent
  const diagTag = String(headerProps.title || 'stack-screen')

  const contentOpacity = useSharedValue(0)
  const fadeStartedRef = useRef(false)

  const onFadeFinish = useCallback(
    (finished?: boolean) => {
      logNavigationPhase(diagTag, 'StackScreenLayout:fadeFinish', {
        finished: Boolean(finished)
      })
    },
    [diagTag]
  )

  const triggerFadeIn = useCallback(
    (triggerSource: string) => {
      if (fadeStartedRef.current) return
      fadeStartedRef.current = true
      logNavigationPhase(diagTag, 'StackScreenLayout:fadeStart', {
        source: triggerSource,
        durationMs: FADE_IN_DURATION_MS
      })
      contentOpacity.value = withTiming(
        1,
        {
          duration: FADE_IN_DURATION_MS,
          easing: Easing.out(Easing.cubic)
        },
        (finished) => {
          runOnJS(onFadeFinish)(finished)
        }
      )
    },
    [contentOpacity, diagTag, onFadeFinish]
  )

  useEffect(() => {
    logNavigationPhase(diagTag, 'StackScreenLayout:mount')
    const stopSample = sampleTransitionFrames(diagTag, 380)
    const fallbackTimer = setTimeout(() => {
      triggerFadeIn('timeout-fallback')
    }, 120)
    return () => {
      clearTimeout(fallbackTimer)
      stopSample()
    }
  }, [diagTag, triggerFadeIn])

  const handleContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (fadeStartedRef.current) return
      const { width, height } = event.nativeEvent.layout
      logNavigationPhase(diagTag, 'StackScreenLayout:onLayout', {
        width: Math.round(width),
        height: Math.round(height)
      })
      requestAnimationFrame(() => {
        triggerFadeIn('onLayout+rAF')
      })
    },
    [diagTag, triggerFadeIn]
  )

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value
  }))

  const safeStyle = useMemo(
    () => ({
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right
    }),
    [insets.top, insets.left, insets.right]
  )

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />
      <View style={[styles.safe, { backgroundColor: bg }, safeStyle]}>
        <StackScreenHeader {...headerProps} transparent={transparent} />
        <Animated.View
          onLayout={handleContentLayout}
          style={[styles.content, contentStyle, animatedContentStyle]}
        >
          {children}
        </Animated.View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1 }
})
