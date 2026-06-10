import { Platform } from 'react-native'
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack'

const FADE_DURATION_MS = Platform.OS === 'ios' ? 250 : 200

/** Native Stack 淡入淡出转场，与 React Navigation `animation: 'fade'` 一致 */
export const fadeStackAnimation: NativeStackNavigationOptions = {
  animation: 'fade',
  ...(Platform.OS === 'ios' ? { animationDuration: FADE_DURATION_MS } : {})
}

/** Bottom Tabs 切换时的淡入淡出转场 */
export const fadeTabAnimation: BottomTabNavigationOptions = {
  animation: 'fade',
  transitionSpec: {
    animation: 'timing',
    config: { duration: FADE_DURATION_MS }
  }
}
