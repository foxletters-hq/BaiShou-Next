import { Platform } from 'react-native'

/**
 * 聚焦输入框后滚入可见区；延迟一次以覆盖键盘弹出动画。
 */
export function scheduleScrollFocusedInputOnFocus(scroll: () => void): void {
  requestAnimationFrame(scroll)
  setTimeout(scroll, Platform.OS === 'ios' ? 280 : 400)
}
