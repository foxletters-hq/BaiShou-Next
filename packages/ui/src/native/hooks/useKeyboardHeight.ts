import { useCallback, useEffect, useRef, useState } from 'react'
import { Keyboard, Platform, useWindowDimensions } from 'react-native'

function resolveKeyboardHeight(
  end: { height: number; screenY: number },
  windowHeight: number
): number {
  if (end.height > 0) return end.height
  if (end.screenY > 0 && windowHeight > end.screenY) {
    return windowHeight - end.screenY
  }
  return Keyboard.metrics()?.height ?? 0
}

export interface UseKeyboardHeightOptions {
  /** 为 true 时忽略 show 事件（如手动锁定 inset） */
  shouldIgnoreShow?: () => boolean
  /** 为 true 时忽略 hide 事件（如工具栏插入中） */
  shouldIgnoreHide?: () => boolean
  /** hide 后额外回调（如解除锁定） */
  onHide?: () => void
}

/**
 * 键盘占用高度 —— 与日记编辑器底部工具栏同一套逻辑。
 * 返回高度后，把底部栏设为 `bottom: keyboardHeight` 或给滚动区加 `paddingBottom` 即可。
 */
export function useKeyboardHeight(options?: UseKeyboardHeightOptions): {
  keyboardHeight: number
  syncFromMetrics: () => void
  resetKeyboard: () => void
} {
  const { height: windowHeight } = useWindowDimensions()
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  const optionsRef = useRef(options)
  optionsRef.current = options

  const resolve = useCallback(
    (end: { height: number; screenY: number }) => resolveKeyboardHeight(end, windowHeight),
    [windowHeight]
  )

  const syncFromMetrics = useCallback(() => {
    const metrics = Keyboard.metrics()
    if (metrics?.height) {
      setKeyboardHeight(metrics.height)
      return
    }
    if (metrics && metrics.screenY > 0 && windowHeight > metrics.screenY) {
      setKeyboardHeight(windowHeight - metrics.screenY)
    }
  }, [windowHeight])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (event) => {
      if (optionsRef.current?.shouldIgnoreShow?.()) return
      setKeyboardHeight(resolve(event.endCoordinates))
    })

    const hideSub = Keyboard.addListener(hideEvent, () => {
      if (optionsRef.current?.shouldIgnoreHide?.()) return
      optionsRef.current?.onHide?.()
      setKeyboardHeight(0)
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [resolve])

  const resetKeyboard = useCallback(() => {
    setKeyboardHeight(0)
  }, [])

  return { keyboardHeight, syncFromMetrics, resetKeyboard }
}
