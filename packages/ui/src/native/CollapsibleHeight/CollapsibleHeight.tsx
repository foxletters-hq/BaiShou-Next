import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated'

export type CollapsibleHeightAnimation = 'spring' | 'ease'

/** 与 SettingsExpansionTile / web collapse 一致的缓动曲线 */
export const COLLAPSIBLE_EASE = Easing.bezier(0.4, 0, 0.2, 1)

export interface CollapsibleHeightProps {
  expanded: boolean
  children: React.ReactNode
  /** spring：设置页分组；ease：聊天气泡附属块 / MCP 等（对齐 desktop 0.3s ease） */
  animation?: CollapsibleHeightAnimation
  durationMs?: number
}

/**
 * 展开/收起高度动画。
 * 动画期间内容保持挂载、绝对定位在裁剪容器内，外层在 UI 线程动画高度；
 * 展开完成进入稳定态（settled）后，外层切回自然流（position: relative、height: auto/undefined），
 * 使内层嵌套的折叠项（如工具调用结果）能以原生 60/120fps 同步自然撑开，彻底杜绝外层追赶动画造成的撕裂与不同步。
 */
export const CollapsibleHeight: React.FC<CollapsibleHeightProps> = ({
  expanded,
  children,
  animation = 'spring',
  durationMs = 300
}) => {
  const [measuredHeight, setMeasuredHeight] = useState(0)
  const [isSettled, setIsSettled] = useState(false)
  const animatedHeight = useSharedValue(0)
  const isSettledShared = useSharedValue(false)
  const isSettledRef = useRef(false)
  const instantMode = durationMs <= 0
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestMeasuredHeightRef = useRef(0)
  const prevExpandedRef = useRef(expanded)
  const isInitialMountRef = useRef(true)
  const expandGenRef = useRef(0)

  const markSettled = useCallback(
    (gen?: number) => {
      if (gen !== undefined && gen !== expandGenRef.current) {
        return
      }
      if (!prevExpandedRef.current) {
        return
      }
      if (latestMeasuredHeightRef.current > 0) {
        animatedHeight.value = latestMeasuredHeightRef.current
      }
      isSettledRef.current = true
      setIsSettled(true)
    },
    [animatedHeight]
  )

  const clearSettled = useCallback(() => {
    expandGenRef.current += 1
    isSettledRef.current = false
    isSettledShared.value = false
    setIsSettled(false)
  }, [isSettledShared])

  useEffect(() => {
    if (isSettled) {
      isSettledShared.value = true
    } else {
      isSettledShared.value = false
    }
  }, [isSettled, isSettledShared])

  const onContentLayout = (event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height)
    if (nextHeight <= 0) return
    if (Math.abs(nextHeight - latestMeasuredHeightRef.current) <= 1) return

    latestMeasuredHeightRef.current = nextHeight
    setMeasuredHeight(nextHeight)

    if (instantMode) {
      animatedHeight.value = expanded ? nextHeight : 0
      if (expanded) {
        markSettled()
      } else {
        clearSettled()
      }
      return
    }

    // 展开稳定态下，子内容（如嵌套思考或工具调用详情）展开/折叠时外层已处于自然流；
    // 同步更新 animatedHeight.value 供后续收起时作为起点，不再重复重启追赶动画
    if (expanded && isSettledRef.current) {
      animatedHeight.value = nextHeight
    }
  }

  useEffect(() => {
    if (instantMode) {
      animatedHeight.value = expanded ? measuredHeight : 0
      if (expanded) {
        markSettled()
      } else {
        clearSettled()
      }
      prevExpandedRef.current = expanded
      isInitialMountRef.current = false
      return
    }

    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }

    const wasExpanded = prevExpandedRef.current
    const isInitial = isInitialMountRef.current

    // 初次挂载：直接展示目标状态，绝不播放展开或收缩动画，彻底避免首屏布局跳动/上滑
    if (isInitial) {
      cancelAnimation(animatedHeight)
      if (!expanded) {
        clearSettled()
        animatedHeight.value = 0
        prevExpandedRef.current = false
        isInitialMountRef.current = false
      } else if (measuredHeight > 0) {
        animatedHeight.value = measuredHeight
        prevExpandedRef.current = true
        markSettled()
        isInitialMountRef.current = false
      }
      return
    }

    prevExpandedRef.current = expanded

    if (!expanded) {
      if (!wasExpanded) {
        return
      }

      if (
        (isSettledRef.current || animatedHeight.value <= 0) &&
        latestMeasuredHeightRef.current > 0
      ) {
        animatedHeight.value = latestMeasuredHeightRef.current
      }

      // 收起：立即退出稳定态，切回绝对定位与固定高度裁剪
      clearSettled()

      cancelAnimation(animatedHeight)
      if (animation === 'ease') {
        animatedHeight.value = withTiming(0, {
          duration: durationMs,
          easing: COLLAPSIBLE_EASE
        })
      } else {
        animatedHeight.value = withSpring(0, {
          damping: 22,
          stiffness: 180,
          mass: 0.8,
          overshootClamping: true
        })
      }
      return
    }

    // 展开阶段 (expanded === true)
    // 若已处于稳定态，无需重复播放展开动画，交由自然流自适应
    if (isSettledRef.current) {
      return
    }

    if (measuredHeight <= 0) {
      return
    }

    const currentGen = ++expandGenRef.current
    cancelAnimation(animatedHeight)

    const onComplete = (finished?: boolean) => {
      'worklet'
      if (finished) {
        runOnJS(markSettled)(currentGen)
      }
    }

    if (animation === 'ease') {
      animatedHeight.value = withTiming(
        measuredHeight,
        {
          duration: durationMs,
          easing: COLLAPSIBLE_EASE
        },
        onComplete
      )
    } else {
      animatedHeight.value = withSpring(
        measuredHeight,
        {
          damping: 22,
          stiffness: 180,
          mass: 0.8,
          overshootClamping: true
        },
        onComplete
      )
    }

    // 兜底定时器：在 JS 线程兜底同步稳定态（防御 mock/降级环境丢失 UI 线程回调）
    settleTimerRef.current = setTimeout(() => {
      markSettled(currentGen)
    }, durationMs + 60)

    return () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current)
        settleTimerRef.current = null
      }
    }
  }, [
    animatedHeight,
    instantMode,
    expanded,
    measuredHeight,
    animation,
    durationMs,
    isSettledShared,
    markSettled,
    clearSettled
  ])

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current)
        settleTimerRef.current = null
      }
      cancelAnimation(animatedHeight)
    }
  }, [animatedHeight])

  const clipStyle = useAnimatedStyle(() => {
    if (isSettledShared.value) {
      return {
        height: 'auto'
      }
    }
    return {
      height: animatedHeight.value
    }
  })

  return (
    <Animated.View
      style={[styles.clip, clipStyle, isSettled ? styles.clipSettled : null]}
      collapsable={false}
      pointerEvents={expanded ? 'auto' : 'none'}
    >
      <View
        onLayout={onContentLayout}
        pointerEvents={expanded ? 'auto' : 'none'}
        style={isSettled ? styles.contentSettled : styles.content}
        collapsable={false}
      >
        {children}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    position: 'relative',
    width: '100%'
  },
  clipSettled: {
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    height: 'auto' as unknown as number
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0
  },
  contentSettled: {
    position: 'relative',
    width: '100%'
  }
})
