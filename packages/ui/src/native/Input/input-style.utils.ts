import { StyleSheet, type StyleProp, type TextStyle } from 'react-native'

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
