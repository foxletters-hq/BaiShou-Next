import { Platform } from 'react-native'
import { TransitionPresets, type BottomTabNavigationOptions } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack'

const FADE_DURATION_MS = Platform.OS === 'ios' ? 250 : 200
const SLIDE_DURATION_MS = Platform.OS === 'ios' ? 300 : 250

/** Native Stack 淡入淡出转场，与 React Navigation `animation: 'fade'` 一致 */
export const fadeStackAnimation: NativeStackNavigationOptions = {
  animation: 'fade',
  animationDuration: FADE_DURATION_MS
}

/** Native Stack 原生滑动转场（iOS 默认原生推入，Android 从右侧滑入） */
export const slideStackAnimation: NativeStackNavigationOptions = {
  animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
  animationDuration: SLIDE_DURATION_MS,
  gestureEnabled: true
}

/** Bottom Tabs 切换时的淡入淡出转场 */
export const fadeTabAnimation: BottomTabNavigationOptions = {
  ...TransitionPresets.FadeTransition,
  animation: 'fade',
  transitionSpec: {
    animation: 'timing',
    config: { duration: FADE_DURATION_MS }
  }
}
