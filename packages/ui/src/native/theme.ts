import { useColorScheme, useWindowDimensions, PixelRatio } from 'react-native'
import { lightColors, darkColors, sharedTokens } from '../theme'
import { buildNativeThemePalette, useNativeThemeContext } from './NativeThemeProvider'

export type { ThemeModePreference } from './NativeThemeProvider'
export { NativeThemeProvider, useNativeThemeContext } from './NativeThemeProvider'

export function useNativeTheme() {
  const { themeMode, seedColor } = useNativeThemeContext()
  const rawScheme = useColorScheme()
  const systemScheme = rawScheme === 'dark' || rawScheme === 'light' ? rawScheme : undefined
  const { width, height } = useWindowDimensions()
  const { colors, tokens, isDark } = buildNativeThemePalette(themeMode, seedColor, systemScheme)

  const isTablet = width >= 768
  const fontScale = PixelRatio.getFontScale()
  const maxModalWidth = Math.min(width * 0.9, 600)

  return {
    colors,
    tokens,
    isDark,
    isTablet,
    screenWidth: width,
    screenHeight: height,
    fontScale,
    maxModalWidth,
    themeMode
  }
}

/** 与桌面滚动条/指示器一致：随深浅色切换 */
export function scrollIndicatorStyle(isDark: boolean): 'white' | 'black' {
  return isDark ? 'white' : 'black'
}
