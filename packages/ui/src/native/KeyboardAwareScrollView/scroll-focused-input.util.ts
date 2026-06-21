import { Dimensions, Keyboard, ScrollView, TextInput } from 'react-native'
import type { RefObject } from 'react'
import { readEffectiveKeyboardHeight } from './scroll-node-into-view.util'

function resolveMeasureTarget() {
  const getFocused = TextInput.State?.currentlyFocusedInput
  const focused = getFocused?.()
  if (focused) return focused
  return null
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
  const windowHeight = Dimensions.get('window').height
  const effectiveKeyboardHeight = readEffectiveKeyboardHeight(windowHeight) || keyboardHeight
  if (!scrollRef.current || effectiveKeyboardHeight <= 0) return

  const focused = resolveMeasureTarget()
  if (!focused) return

  focused.measureInWindow((_x, inputY, _w, inputH) => {
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
