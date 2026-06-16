import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Keyboard, Platform, useWindowDimensions } from 'react-native'

function applyKeyboardHeight(setKeyboardHeight: Dispatch<SetStateAction<number>>, next: number) {
  setKeyboardHeight((prev) => (prev === next ? prev : next))
}

function readKeyboardHeightFromMetrics(windowHeight: number): number {
  const metrics = Keyboard.metrics()
  if (!metrics) return 0
  if (metrics.height > 0) return metrics.height
  if (metrics.screenY > 0 && windowHeight > metrics.screenY) {
    return windowHeight - metrics.screenY
  }
  return 0
}

function resolveKeyboardHeight(
  end: { height: number; screenY: number },
  windowHeight: number
): number {
  if (end.height > 0) return end.height
  if (end.screenY > 0 && windowHeight > end.screenY) {
    return windowHeight - end.screenY
  }
  return readKeyboardHeightFromMetrics(windowHeight)
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
    applyKeyboardHeight(setKeyboardHeight, readKeyboardHeightFromMetrics(windowHeight))
  }, [windowHeight])

  const clearHideTimer = useCallback(() => {
    if (!hideTimerRef.current) return
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = null
  }, [])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const applyShow = (end: { height: number; screenY: number }) => {
      if (optionsRef.current?.shouldIgnoreShow?.()) return
      clearHideTimer()
      applyKeyboardHeight(setKeyboardHeight, resolve(end))
    }

    const applyHide = () => {
      if (optionsRef.current?.shouldIgnoreHide?.()) return
      optionsRef.current?.onHide?.()
      clearHideTimer()
      applyKeyboardHeight(setKeyboardHeight, 0)
      // Android metrics 可能滞后；仅当仍检测到键盘时才回填，避免 iOS hide 后被 metrics 弹回
      if (Platform.OS === 'android') {
        hideTimerRef.current = setTimeout(() => {
          hideTimerRef.current = null
          const fromMetrics = readKeyboardHeightFromMetrics(windowHeight)
          if (fromMetrics > 0) {
            applyKeyboardHeight(setKeyboardHeight, fromMetrics)
          }
        }, 48)
      }
    }

    const subs = [
      Keyboard.addListener(showEvent, (event) => {
        applyShow(event.endCoordinates)
      }),
      Keyboard.addListener(hideEvent, applyHide)
    ]

    if (Platform.OS === 'ios') {
      subs.push(
        Keyboard.addListener('keyboardWillChangeFrame', (event) => {
          applyShow(event.endCoordinates)
        })
      )
    }

    return () => {
      clearHideTimer()
      subs.forEach((sub) => sub.remove())
    }
  }, [clearHideTimer, resolve, windowHeight])

  const resetKeyboard = useCallback(() => {
    clearHideTimer()
    applyKeyboardHeight(setKeyboardHeight, 0)
  }, [clearHideTimer])

  return { keyboardHeight, syncFromMetrics, resetKeyboard }
}
