import React, { useEffect, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
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
 * 展开/收起高度动画。内容绝对定位在裁剪容器内，外层只动画高度。
 */
export const CollapsibleHeight: React.FC<CollapsibleHeightProps> = ({
  expanded,
  children,
  animation = 'spring',
  durationMs = 300
}) => {
  const [measuredHeight, setMeasuredHeight] = useState(0)
  const animatedHeight = useSharedValue(0)

  const onContentLayout = (event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height)
    if (nextHeight > 0 && nextHeight !== measuredHeight) {
      setMeasuredHeight(nextHeight)
    }
  }

  useEffect(() => {
    const target = expanded ? measuredHeight : 0
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
  }, [animatedHeight, expanded, measuredHeight, animation, durationMs])

  const clipStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value
  }))

  return (
    <Animated.View style={[styles.clip, clipStyle]} collapsable={false}>
      <View
        onLayout={onContentLayout}
        pointerEvents={expanded ? 'auto' : 'none'}
        style={styles.content}
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
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0
  }
})
