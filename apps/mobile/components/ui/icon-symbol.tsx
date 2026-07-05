// Fallback for using Lucide on Android and web.

import { ChevronRight, Code, Home, Send } from 'lucide-react-native'
import { SymbolWeight } from 'expo-symbols'
import { OpaqueColorValue, type StyleProp, type ViewStyle } from 'react-native'

/**
 * Add your SF Symbols to Lucide mappings here.
 * - see Lucide icons at https://lucide.dev/icons/
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': Home,
  'paperplane.fill': Send,
  'chevron.left.forwardslash.chevron.right': Code,
  'chevron.right': ChevronRight
} as const

type IconSymbolName = keyof typeof MAPPING

/**
 * An icon component that uses native SF Symbols on iOS, and Lucide on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Lucide icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style
}: {
  name: IconSymbolName
  size?: number
  color: string | OpaqueColorValue
  style?: StyleProp<ViewStyle>
  weight?: SymbolWeight
}) {
  const Icon = MAPPING[name]
  return <Icon color={color as string} size={size} strokeWidth={2} style={style} />
}
