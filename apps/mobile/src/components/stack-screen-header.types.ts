import type { MaterialIcons } from '@expo/vector-icons'

/** 顶栏右侧操作：图标或文字二选一 */
export interface StackScreenHeaderActionConfig {
  icon?: keyof typeof MaterialIcons.glyphMap
  label?: string
  onPress: () => void
  accessibilityLabel?: string
  disabled?: boolean
}
