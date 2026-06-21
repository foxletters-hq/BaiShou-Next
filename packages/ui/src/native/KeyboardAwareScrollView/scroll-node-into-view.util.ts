import { Dimensions, Keyboard, ScrollView, TextInput, type View } from 'react-native'
import type { RefObject } from 'react'

type Measurable = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void
}

export function readEffectiveKeyboardHeight(
  windowHeight = Dimensions.get('window').height
): number {
  const metrics = Keyboard.metrics()
  if (!metrics) return 0
  if (metrics.height > 0) return metrics.height
  if (metrics.screenY > 0 && windowHeight > metrics.screenY) {
    return windowHeight - metrics.screenY
  }
  return 0
}

function resolveMeasureTarget(
  fallback?: Measurable | null,
  preferFallback = false
): Measurable | null {
  if (preferFallback && fallback?.measureInWindow) return fallback

  const getFocused = TextInput.State?.currentlyFocusedInput
  const focused = getFocused?.()
  if (focused) return focused
  if (fallback?.measureInWindow) return fallback
  return null
}

/**
 * 计算最小滚动量：仅当目标区域底部被键盘遮挡时向下滚。
 * 若光标已在屏幕上方，则限制滚动，避免把正在编辑的顶部内容顶出视口。
 */
export function computeRevealScrollDelta({
  nodeTop,
  nodeBottom,
  safeTop,
  safeBottom
}: {
  nodeTop: number
  nodeBottom: number
  safeTop: number
  safeBottom: number
}): number {
  if (nodeBottom <= safeBottom + 4) return 0

  const needed = nodeBottom - safeBottom
  if (nodeTop <= safeTop + 4) return needed

  const maxWithoutHidingTop = nodeTop - safeTop
  if (maxWithoutHidingTop <= 0) return needed

  return Math.min(needed, maxWithoutHidingTop)
}

/**
 * 将 ScrollView 滚动，使目标节点露出在键盘与底部固定栏之上。
 */
export function scrollScrollViewToRevealNode({
  scrollRef,
  scrollYRef,
  bottomChromeHeight,
  topChromeHeight = 0,
  fallbackMeasureTarget,
  preferFallbackMeasure = false,
  keyboardHeightOverride,
  animated = true
}: {
  scrollRef: RefObject<ScrollView | null>
  scrollYRef: RefObject<number>
  bottomChromeHeight: number
  topChromeHeight?: number
  fallbackMeasureTarget?: Measurable | null
  /** 日记等场景：始终用自定义测量（如光标区域），避免整块输入框测量触发错误滚动 */
  preferFallbackMeasure?: boolean
  /** Keyboard.metrics 滞后时的备用键盘高度 */
  keyboardHeightOverride?: number
  animated?: boolean
}): void {
  const windowHeight = Dimensions.get('window').height
  const keyboardHeight = readEffectiveKeyboardHeight(windowHeight) || keyboardHeightOverride || 0
  if (!scrollRef.current || keyboardHeight <= 0) return

  const target = resolveMeasureTarget(fallbackMeasureTarget, preferFallbackMeasure)
  if (!target) return

  target.measureInWindow((_x, y, _w, height) => {
    const keyboardTop = windowHeight - keyboardHeight
    const safeBottom = keyboardTop - bottomChromeHeight
    const scrollDelta = computeRevealScrollDelta({
      nodeTop: y,
      nodeBottom: y + height,
      safeTop: topChromeHeight,
      safeBottom
    })
    if (scrollDelta <= 0) return

    scrollRef.current?.scrollTo({
      y: scrollYRef.current + scrollDelta,
      animated
    })
  })
}

export type ViewMeasureRef = RefObject<View | null>
