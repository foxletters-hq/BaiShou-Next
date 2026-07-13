import React, { useEffect, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
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
 * 展开/收起高度动画。内容绝对定位在裁剪容器内，外层动画高度。
 * 高度同步回 React layout，确保 ScrollView contentSize / 父级 onLayout 能跟上
 * （否则折叠思考后列表仍按展开高度滚动，底部会多出空白）。
 */
export const CollapsibleHeight: React.FC<CollapsibleHeightProps> = ({
  expanded,
  children,
  animation = 'spring',
  durationMs = 300
}) => {
  const [measuredHeight, setMeasuredHeight] = useState(0)
  const [layoutHeight, setLayoutHeight] = useState(0)
  const animatedHeight = useSharedValue(0)
  const instantMode = durationMs <= 0

  const onContentLayout = (event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height)
    if (nextHeight <= 0) return
    if (Math.abs(nextHeight - measuredHeight) <= 1) return

    if (instantMode) {
      animatedHeight.value = expanded ? nextHeight : 0
      setMeasuredHeight(nextHeight)
      setLayoutHeight(expanded ? nextHeight : 0)
      return
    }

    setMeasuredHeight(nextHeight)
  }

  useEffect(() => {
    if (!instantMode) return
    const next = expanded ? measuredHeight : 0
    animatedHeight.value = next
    setLayoutHeight(next)
  }, [animatedHeight, instantMode, expanded, measuredHeight])

  useEffect(() => {
    if (instantMode) return
    const target = expanded ? measuredHeight : 0
    cancelAnimation(animatedHeight)
    if (animation === 'ease') {
      animatedHeight.value = withTiming(target, {
        duration: durationMs,
        easing: COLLAPSIBLE_EASE
      })
      return
    }
    animatedHeight.value = withSpring(target, {
      damping: 22,
      stiffness: 180,
      mass: 0.8,
      overshootClamping: true
    })
  }, [animatedHeight, instantMode, expanded, measuredHeight, animation, durationMs])

  useAnimatedReaction(
    () => Math.max(0, Math.ceil(animatedHeight.value)),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setLayoutHeight)(current)
      }
    },
    [animatedHeight]
  )

  useEffect(() => {
    return () => {
      cancelAnimation(animatedHeight)
    }
  }, [animatedHeight])

  return (
    <View style={[styles.clip, { height: layoutHeight }]} collapsable={false}>
      <View
        onLayout={onContentLayout}
        pointerEvents={expanded ? 'auto' : 'none'}
        style={styles.content}
        collapsable={false}
      >
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    position: 'relative',
    width: '100%'
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0
  }
})
