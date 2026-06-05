import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import type { lightColors } from '../../theme'

type ThemeColors = typeof lightColors

/** HeroUI Input 默认场域外观（rounded-2xl + 1px 边框），不依赖 Uniwind 是否生效 */
export function getHeroInputFieldStyle(
  colors: ThemeColors,
  options?: { multiline?: boolean }
): TextStyle {
  return {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    borderCurve: 'continuous',
    minHeight: options?.multiline ? undefined : 48,
    paddingHorizontal: 12,
    color: colors.textPrimary
  }
}

export function isCompactInputStyle(style?: StyleProp<TextStyle>): boolean {
  const flat = StyleSheet.flatten(style)
  if (!flat) return false
  return flat.width != null || flat.maxWidth != null
}

export function getCompactTextFieldStyle(style?: StyleProp<TextStyle>): ViewStyle | undefined {
  const flat = StyleSheet.flatten(style)
  if (!flat?.width && !flat?.maxWidth) return undefined
  return {
    width: flat.width,
    maxWidth: flat.maxWidth,
    flexShrink: 0,
    alignSelf: 'flex-end'
  }
}
