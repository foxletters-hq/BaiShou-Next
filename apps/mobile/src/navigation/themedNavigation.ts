import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native'
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack'
import { fadeStackAnimation } from './fadeStackAnimation'

/** React Navigation 主题色与 App 色板对齐，避免 fade 转场时露出默认白底 */
export function buildAppNavigationTheme(isDark: boolean, bgApp: string): Theme {
  const base = isDark ? DarkTheme : DefaultTheme
  return {
    ...base,
    colors: {
      ...base.colors,
      background: bgApp,
      card: bgApp
    }
  }
}

/** 带主题底色的 fade 栈选项（转场期间底层不再闪白） */
export function buildThemedFadeStackOptions(bgApp: string): NativeStackNavigationOptions {
  return {
    ...fadeStackAnimation,
    contentStyle: { flex: 1, backgroundColor: bgApp }
  }
}
