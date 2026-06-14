import { Dimensions, Keyboard, ScrollView, TextInput } from 'react-native'
import type { RefObject } from 'react'

function resolveKeyboardHeight(reported: number): number {
  if (reported > 0) return reported

  const metrics = Keyboard.metrics()
  if (!metrics) return 0
  if (metrics.height > 0) return metrics.height

  const windowHeight = Dimensions.get('window').height
  if (metrics.screenY > 0 && windowHeight > metrics.screenY) {
    return windowHeight - metrics.screenY
  }

  return 0
}

/**
 * 键盘弹出后，将当前聚焦的输入框滚入可见区域（适配 Android adjustNothing）。
 */
export function scrollFocusedInputIntoView(
  scrollRef: RefObject<ScrollView | null>,
  scrollYRef: RefObject<number>,
  keyboardHeight: number,
  extraOffset = 24
): void {
  const effectiveKeyboardHeight = resolveKeyboardHeight(keyboardHeight)
  if (!scrollRef.current || effectiveKeyboardHeight <= 0) return

  const getFocused = TextInput.State?.currentlyFocusedInput
  if (!getFocused) return

  const focused = getFocused()
  if (!focused?.measureInWindow) return

  focused.measureInWindow((_x, inputY, _w, inputH) => {
    const windowHeight = Dimensions.get('window').height
    const keyboardTop = windowHeight - effectiveKeyboardHeight
    const inputBottom = inputY + inputH
    const targetBottom = keyboardTop - extraOffset

    if (inputBottom > targetBottom) {
      const delta = inputBottom - targetBottom
      scrollRef.current?.scrollTo({
        y: scrollYRef.current + delta,
        animated: true
      })
    }
  })
}
