import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { mobileTypography, sharedTokens } from '../../theme/tokens'
import { useNativeTheme } from '../theme'
import {
  segmentedEqualItemFrames,
  segmentedThumbRect,
  type SegmentedItemFrame
} from './segmented-control.utils'

export interface SegmentedControlOption<T extends string = string> {
  value: T
  label: string
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string = string> {
  value: T
  options: ReadonlyArray<SegmentedControlOption<T>>
  onChange: (value: T) => void
  /** 顶栏等紧凑场景用小号 */
  size?: 'small'
  /** 默认拉满容器宽度；工具栏旁的切换传 false，宽度跟文案走 */
  stretch?: boolean
  disabled?: boolean
  accessibilityLabel?: string
}

const TRACK_PADDING = 3
const TRACK_PADDING_SMALL = 2

const SEGMENTED_SPRING_CONFIG = {
  damping: 20,
  stiffness: 220,
  mass: 0.6
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size,
  stretch = true,
  disabled = false,
  accessibilityLabel
}: SegmentedControlProps<T>): React.ReactElement {
  const { colors } = useNativeTheme()
  const compact = size === 'small'
  const trackPadding = compact ? TRACK_PADDING_SMALL : TRACK_PADDING
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )
  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex
  const framesRef = useRef<Array<SegmentedItemFrame | undefined>>([])
  const hasMeasuredThumbRef = useRef(false)
  const [thumbReady, setThumbReady] = useState(false)
  const thumbLeft = useSharedValue(0)
  const thumbWidth = useSharedValue(0)
  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    width: thumbWidth.value,
    transform: [{ translateX: thumbLeft.value }]
  }))

  const applyThumb = useCallback(
    (index: number) => {
      const rect = segmentedThumbRect(framesRef.current, index)
      if (!rect) return
      if (!hasMeasuredThumbRef.current) {
        thumbLeft.value = rect.left
        thumbWidth.value = rect.width
        hasMeasuredThumbRef.current = true
        setThumbReady(true)
        return
      }
      thumbLeft.value = withSpring(rect.left, SEGMENTED_SPRING_CONFIG)
      thumbWidth.value = withSpring(rect.width, SEGMENTED_SPRING_CONFIG)
    },
    [thumbLeft, thumbWidth]
  )

  useEffect(() => {
    applyThumb(activeIndex)
  }, [activeIndex, applyThumb])

  const onInnerLayout = (event: LayoutChangeEvent) => {
    if (!stretch) return
    const frames = segmentedEqualItemFrames(event.nativeEvent.layout.width, options.length)
    if (!frames) return
    framesRef.current = frames
    applyThumb(activeIndexRef.current)
  }

  const onItemLayout = (index: number, event: LayoutChangeEvent) => {
    if (stretch) return
    const { x, width } = event.nativeEvent.layout
    const prev = framesRef.current[index]
    if (prev && prev.x === x && prev.width === width) return
    const next = framesRef.current.slice()
    next[index] = { x, width }
    framesRef.current = next
    applyThumb(activeIndexRef.current)
  }

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        compact && styles.trackSmall,
        !stretch && styles.trackHug,
        {
          padding: trackPadding,
          backgroundColor: colors.bgSurfaceNormal,
          borderColor: colors.borderControl
        }
      ]}
    >
      <View
        collapsable={false}
        onLayout={onInnerLayout}
        style={[styles.inner, !stretch && styles.innerHug]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            compact && styles.thumbSmall,
            thumbAnimatedStyle,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              opacity: thumbReady ? 1 : 0
            }
          ]}
        />
        {options.map((option, index) => {
          const active = option.value === value
          const itemDisabled = disabled || option.disabled
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled: itemDisabled }}
              disabled={itemDisabled}
              onLayout={(event) => onItemLayout(index, event)}
              style={[
                styles.item,
                compact && styles.itemSmall,
                !stretch && styles.itemHug,
                active && !thumbReady
                  ? {
                      backgroundColor: colors.bgSurface,
                      borderRadius: compact ? sharedTokens.radius.xs : sharedTokens.radius.sm,
                      borderColor: colors.borderSubtle,
                      borderWidth: StyleSheet.hairlineWidth
                    }
                  : null
              ]}
              onPress={() => {
                if (option.value !== value) onChange(option.value)
              }}
            >
              <Text
                style={[
                  styles.label,
                  compact && styles.labelSmall,
                  { color: active ? colors.primary : colors.textSecondary }
                ]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    alignSelf: 'stretch',
    borderRadius: sharedTokens.radius.control,
    borderWidth: 1,
    overflow: 'hidden'
  },
  trackSmall: {
    borderRadius: sharedTokens.radius.sm
  },
  trackHug: {
    alignSelf: 'center'
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    position: 'relative',
    overflow: 'visible'
  },
  innerHug: {
    alignSelf: 'flex-start'
  },
  thumb: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: StyleSheet.hairlineWidth
  },
  thumbSmall: {
    borderRadius: sharedTokens.radius.xs
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.xs,
    minWidth: 0,
    zIndex: 1
  },
  itemSmall: {
    paddingVertical: sharedTokens.spacing.xs,
    paddingHorizontal: sharedTokens.spacing.xs
  },
  itemHug: {
    flex: 0,
    paddingHorizontal: sharedTokens.spacing.sm
  },
  label: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '500'
  },
  labelSmall: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight
  }
})
