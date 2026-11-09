import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import type { lightColors } from '../../theme'
import { mobileControlTokens, sharedTokens } from '../../theme/tokens'

type ThemeColors = typeof lightColors

/** HeroUI Input 默认场域外观（rounded-2xl + 1px 边框），不依赖 Uniwind 是否生效 */
export function getHeroInputFieldStyle(
  colors: ThemeColors,
  options?: { multiline?: boolean; compact?: boolean; height?: number }
): TextStyle {
  const singleLineHeight =
    options?.multiline || options?.compact
      ? undefined
      : (options?.height ?? mobileControlTokens.height)
  return {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderControl,
    borderRadius: sharedTokens.radius.lg,
    borderCurve: 'continuous',
    minHeight: singleLineHeight,
    maxHeight: singleLineHeight,
    width: options?.compact ? undefined : '100%',
    paddingHorizontal: mobileControlTokens.inputPaddingHorizontal,
    ...(options?.multiline ? { paddingVertical: sharedTokens.spacing.smPlus } : null),
    color: colors.textPrimary
  }
}

function flattenTextStyle(style?: StyleProp<TextStyle>): TextStyle | undefined {
  if (typeof StyleSheet?.flatten === 'function') {
    return StyleSheet.flatten(style)
  }
  if (!style) return undefined
  if (Array.isArray(style)) {
    return Object.assign(
      {},
      ...style.map((item) => flattenTextStyle(item as StyleProp<TextStyle>) ?? {})
    )
  }
  return typeof style === 'object' ? (style as TextStyle) : undefined
}

export function isCompactInputStyle(style?: StyleProp<TextStyle>): boolean {
  const flat = flattenTextStyle(style)
  if (!flat) return false
  return flat.width != null || flat.maxWidth != null
}

export function getCompactTextFieldStyle(style?: StyleProp<TextStyle>): ViewStyle | undefined {
  const flat = flattenTextStyle(style)
  if (!flat?.width && !flat?.maxWidth && flat?.height !== '100%' && flat?.flex == null) {
    return undefined
  }
  const layout: ViewStyle = {}
  if (flat.width != null || flat.maxWidth != null) {
    layout.width = flat.width
    layout.maxWidth = flat.maxWidth
    layout.flexShrink = 0
    layout.alignSelf = 'flex-end'
  }
  if (flat.height === '100%') {
    layout.height = '100%'
    layout.flex = 1
  } else if (flat.flex != null) {
    layout.flex = flat.flex
  }
  return layout
}
