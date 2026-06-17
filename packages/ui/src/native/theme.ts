import { useColorScheme, useWindowDimensions, PixelRatio, Appearance } from 'react-native'
import { buildNativeThemePalette, useNativeThemeContext } from './NativeThemeProvider'

export type { ThemeModePreference } from './NativeThemeProvider'
export { NativeThemeProvider, useNativeThemeContext } from './NativeThemeProvider'

function resolveSystemColorScheme(
  raw: ReturnType<typeof useColorScheme>
): 'light' | 'dark' | undefined {
  if (raw === 'dark' || raw === 'light') return raw
  const fallback = Appearance.getColorScheme()
  if (fallback === 'dark' || fallback === 'light') return fallback
  return undefined
}

/** RN 阴影：暗色下避免用 textPrimary 作 shadowColor（会呈诡异白光） */
export function getNativeElevationStyle(isDark: boolean, level: 'subtle' | 'raised' = 'subtle') {
  if (isDark) {
    return level === 'raised'
      ? {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.4,
          shadowRadius: 5,
          elevation: 5
        }
      : {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.28,
          shadowRadius: 2.5,
          elevation: 2
        }
  }

  return level === 'raised'
    ? {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 6
      }
    : {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4
      }
}

export function useNativeTheme() {
  const { themeMode, seedColor } = useNativeThemeContext()
  const rawScheme = useColorScheme()
  const systemScheme = resolveSystemColorScheme(rawScheme)
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
