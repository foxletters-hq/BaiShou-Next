import React, { useEffect, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

export interface CollapsibleHeightProps {
  expanded: boolean
  children: React.ReactNode
}

/**
 * 设置项展开/收起。
 * 单份内容绝对定位在裁剪容器内，外层只动画高度，避免收起时残影/重叠。
 */
export const CollapsibleHeight: React.FC<CollapsibleHeightProps> = ({ expanded, children }) => {
  const [measuredHeight, setMeasuredHeight] = useState(0)
  const animatedHeight = useSharedValue(0)

  const onContentLayout = (event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height)
    if (nextHeight > 0 && nextHeight !== measuredHeight) {
      setMeasuredHeight(nextHeight)
    }
  }

  useEffect(() => {
    animatedHeight.value = withSpring(expanded ? measuredHeight : 0, {
      damping: 22,
      stiffness: 180,
      mass: 0.8,
      overshootClamping: true
    })
  }, [animatedHeight, expanded, measuredHeight])

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
    position: 'relative'
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0
  }
})
