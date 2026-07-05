import type { LucideIcon } from 'lucide-react-native'

/** 顶栏右侧操作：图标或文字二选一 */
export interface StackScreenHeaderActionConfig {
  icon?: LucideIcon
  label?: string
  onPress: () => void
  accessibilityLabel?: string
  disabled?: boolean
}
