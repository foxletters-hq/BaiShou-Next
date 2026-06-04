import { useCallback, useEffect, useRef } from 'react'
import { Keyboard, Platform } from 'react-native'
import { Easing, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'

const DEFAULT_KEYBOARD_HEIGHT = 280

function keyboardAnimDuration(event: { duration?: number }, fallback = 220) {
  if (Platform.OS === 'ios' && event.duration && event.duration > 0) {
    return event.duration
  }
  return fallback
}

export interface KeyboardInsetController {
  /** Reanimated 共享值，用于 inputDock 的 bottom */
  inset: SharedValue<number>
  /** 输入框聚焦时立即预抬，避免 Tab 收起后闪到底部 */
  prepareForKeyboard: () => void
  /** 键盘已打开（用于列表留白等布局） */
  isOpen: SharedValue<number>
}

/** 键盘占用高度（动画），用于将底部输入栏平滑顶到输入法上方 */
export function useKeyboardInset(): KeyboardInsetController {
  const inset = useSharedValue(0)
  const isOpen = useSharedValue(0)
  const lastHeightRef = useRef(DEFAULT_KEYBOARD_HEIGHT)

  const animateTo = useCallback(
    (height: number, duration = 220) => {
      inset.value = withTiming(height, {
        duration,
        easing: Easing.out(Easing.cubic)
      })
      isOpen.value = height > 0 ? 1 : 0
    },
    [inset, isOpen]
  )

  const prepareForKeyboard = useCallback(() => {
    animateTo(lastHeightRef.current, Platform.OS === 'ios' ? 260 : 180)
  }, [animateTo])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const height = event.endCoordinates.height
      lastHeightRef.current = height
      animateTo(height, keyboardAnimDuration(event))
    })

    const hideSub = Keyboard.addListener(hideEvent, (event) => {
      animateTo(0, keyboardAnimDuration(event))
    })

    // Android 部分版本会提前触发 willShow，减少 didShow 之前的闪动
    const willShowSub =
      Platform.OS === 'android'
        ? Keyboard.addListener('keyboardWillShow', (event) => {
            const height = event.endCoordinates.height
            if (height > 0) {
              lastHeightRef.current = height
              animateTo(height, keyboardAnimDuration(event, 180))
            }
          })
        : null

    return () => {
      showSub.remove()
      hideSub.remove()
      willShowSub?.remove()
    }
  }, [animateTo])

  return { inset, prepareForKeyboard, isOpen }
}
