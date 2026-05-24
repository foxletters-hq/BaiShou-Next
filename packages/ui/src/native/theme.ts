import { useColorScheme, useWindowDimensions, PixelRatio } from 'react-native'
import { lightColors, darkColors, sharedTokens } from '../theme'

export function useNativeTheme() {
  const scheme = useColorScheme()
  const { width, height } = useWindowDimensions()
  const isDark = scheme === 'dark'
  const colors = isDark ? darkColors : lightColors

  const isTablet = width >= 768
  const fontScale = PixelRatio.getFontScale()
  const maxModalWidth = Math.min(width * 0.9, 600)

  return {
    colors,
    tokens: sharedTokens,
    isDark,
    isTablet,
    screenWidth: width,
    screenHeight: height,
    fontScale,
    maxModalWidth
  }
}
