import { Platform } from 'react-native'

/**
 * 聚焦输入框后分阶段滚入可见区，覆盖键盘动画与切换焦点场景。
 */
export function scheduleScrollFocusedInputOnFocus(scroll: () => void): void {
  scroll()
  setTimeout(scroll, Platform.OS === 'ios' ? 80 : 160)
  setTimeout(scroll, Platform.OS === 'ios' ? 340 : 480)
}
