import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'

/** RN `style` 会覆盖 NativeWind 的圆角/边框，需剥离后交由 HeroUI Input 的 className 绘制 */
const INPUT_CHROME_KEYS = [
  'borderRadius',
  'borderWidth',
  'borderColor',
  'borderStyle',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor'
] as const satisfies readonly (keyof TextStyle)[]

export function sanitizeHeroInputStyle(
  style?: StyleProp<TextStyle>
): StyleProp<TextStyle> | undefined {
  if (style == null) return undefined
  const flat = StyleSheet.flatten(style)
  if (!flat) return style

  const sanitized = { ...flat }
  for (const key of INPUT_CHROME_KEYS) {
    delete sanitized[key]
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

/**
 * 带 left/right slot 时，垂直 margin 应落在外层容器上；
 * 否则绝对定位的 slot 会按「输入框 + margin」整体居中，图标看起来偏上。
 */
export function splitInputLayoutStyle(style?: StyleProp<TextStyle>): {
  inputStyle?: StyleProp<TextStyle>
  wrapperStyle?: StyleProp<ViewStyle>
} {
  const flat = StyleSheet.flatten(style)
  if (!flat) {
    return { inputStyle: style }
  }

  const { marginTop, marginBottom, marginVertical, ...rest } = flat
  const wrapperStyle: ViewStyle = {}
  if (marginTop != null) wrapperStyle.marginTop = marginTop
  if (marginBottom != null) wrapperStyle.marginBottom = marginBottom
  if (marginVertical != null) {
    wrapperStyle.marginTop = marginVertical
    wrapperStyle.marginBottom = marginVertical
  }

  const inputStyle = Object.keys(rest).length > 0 ? rest : undefined
  const wrapper =
    Object.keys(wrapperStyle).length > 0 ? wrapperStyle : undefined

  return { inputStyle, wrapperStyle: wrapper }
}
