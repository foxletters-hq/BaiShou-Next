import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Keyboard, Platform, useWindowDimensions } from 'react-native'

function applyKeyboardHeight(
  setKeyboardHeight: Dispatch<SetStateAction<number>>,
  next: number
) {
  setKeyboardHeight((prev) => (prev === next ? prev : next))
}

function isKeyboardStillVisible(windowHeight: number): boolean {
  const metrics = Keyboard.metrics()
  if (!metrics) return false
  if (metrics.height > 0) return true
  return Boolean(metrics.screenY > 0 && windowHeight > metrics.screenY)
}

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
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const optionsRef = useRef(options)
  optionsRef.current = options

  const resolve = useCallback(
    (end: { height: number; screenY: number }) => resolveKeyboardHeight(end, windowHeight),
    [windowHeight]
  )

  const syncFromMetrics = useCallback(() => {
    const metrics = Keyboard.metrics()
    if (metrics?.height) {
      applyKeyboardHeight(setKeyboardHeight, metrics.height)
      return
    }
    if (metrics && metrics.screenY > 0 && windowHeight > metrics.screenY) {
      applyKeyboardHeight(setKeyboardHeight, windowHeight - metrics.screenY)
    }
  }, [windowHeight])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (event) => {
      if (optionsRef.current?.shouldIgnoreShow?.()) return
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      applyKeyboardHeight(setKeyboardHeight, resolve(event.endCoordinates))
    })

    const hideSub = Keyboard.addListener(hideEvent, () => {
      if (optionsRef.current?.shouldIgnoreHide?.()) return
      optionsRef.current?.onHide?.()
      requestAnimationFrame(() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
        hideTimerRef.current = setTimeout(() => {
          hideTimerRef.current = null
          if (isKeyboardStillVisible(windowHeight)) return
          applyKeyboardHeight(setKeyboardHeight, 0)
        }, 80)
      })
    })

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      showSub.remove()
      hideSub.remove()
    }
  }, [resolve, windowHeight])

  const resetKeyboard = useCallback(() => {
    applyKeyboardHeight(setKeyboardHeight, 0)
  }, [])

  return { keyboardHeight, syncFromMetrics, resetKeyboard }
}
